import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { slates } from "../src/db/schema";
import { getSlateJson } from "../src/db/slateRepo";

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
});
