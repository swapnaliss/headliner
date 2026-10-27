import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { slates } from "../src/db/schema";
import { getSlateJson, patchSlateJson, updateSlateJson } from "../src/db/slateRepo";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

describe("getSlateJson (PGlite)", () => {
  let client: PGlite;
  let db: Db;
  const now = new Date("2026-10-26T12:00:00.000Z");

  beforeAll(async () => {
    client = new PGlite();
    const pg = drizzlePglite(client);
    await migrate(pg, { migrationsFolder });
    db = pg as unknown as Db;
    await db.insert(slates).values({ id: "live-slate-id", json: { id: "live-slate-id" }, createdAt: now, expiresAt: new Date(now.getTime() + 1000) });
    await db.insert(slates).values({ id: "old-slate-id", json: { id: "old-slate-id" }, createdAt: now, expiresAt: new Date(now.getTime() - 1000) });
  });
  afterAll(async () => {
    await client.close();
  });

  it("returns the stored JSON while unexpired", async () => {
    expect(await getSlateJson(db, "live-slate-id", now)).toEqual({ id: "live-slate-id" });
  });
  it("returns null for an expired row and for an unknown id", async () => {
    expect(await getSlateJson(db, "old-slate-id", now)).toBeNull();
    expect(await getSlateJson(db, "nope", now)).toBeNull();
  });
  it("updateSlateJson replaces the JSON of a live slate and keeps its expiry", async () => {
    expect(await updateSlateJson(db, "live-slate-id", { id: "live-slate-id", more: 1 }, now)).toBe(true);
    expect(await getSlateJson(db, "live-slate-id", now)).toEqual({ id: "live-slate-id", more: 1 });
    expect(await getSlateJson(db, "live-slate-id", new Date(now.getTime() + 2000))).toBeNull();
  });
  it("updateSlateJson changes nothing for an expired or unknown slate", async () => {
    expect(await updateSlateJson(db, "old-slate-id", { changed: true }, now)).toBe(false);
    expect(await updateSlateJson(db, "nope", { changed: true }, now)).toBe(false);
  });
  it("patchSlateJson serialises concurrent patches so none is lost (BL-01 6434847617)", async () => {
    await db.insert(slates).values({ id: "race-slate-id", json: { id: "race-slate-id", a: 0, b: 0 }, createdAt: now, expiresAt: new Date(now.getTime() + 1000) });
    const bump = (key: "a" | "b") => patchSlateJson(db, "race-slate-id", (cur) => ({ ...(cur as object), [key]: 1 }), now);
    const results = await Promise.all([bump("a"), bump("b")]);
    expect(results).toEqual([true, true]);
    expect(await getSlateJson(db, "race-slate-id", now)).toEqual({ id: "race-slate-id", a: 1, b: 1 });
  });
  it("patchSlateJson writes nothing when the patch returns null, or for an expired or unknown slate", async () => {
    expect(await patchSlateJson(db, "live-slate-id", () => null, now)).toBe(false);
    expect(await patchSlateJson(db, "old-slate-id", () => ({ changed: true }), now)).toBe(false);
    expect(await patchSlateJson(db, "nope", () => ({ changed: true }), now)).toBe(false);
    expect(await getSlateJson(db, "live-slate-id", now)).toEqual({ id: "live-slate-id", more: 1 });
  });
});
