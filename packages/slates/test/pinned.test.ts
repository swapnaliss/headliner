import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { slates } from "../src/db/schema";
import { getSlateJson, isPinnedExpiry, PINNED_EXPIRES_AT, purgeExpiredSlates, putPinnedSlate } from "../src/db/slateRepo";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

describe("pinned sample slates (PGlite)", () => {
  let client: PGlite;
  let db: Db;
  const now = new Date("2026-10-27T12:00:00.000Z");
  const longAfter = new Date("2031-01-01T00:00:00.000Z");

  beforeAll(async () => {
    client = new PGlite();
    const pg = drizzlePglite(client);
    await migrate(pg, { migrationsFolder });
    db = pg as unknown as Db;
    await db.insert(slates).values({ id: "expired-slate", json: { id: "expired-slate" }, createdAt: now, expiresAt: new Date(now.getTime() - 1000) });
    await db.insert(slates).values({ id: "live-slate", json: { id: "live-slate" }, createdAt: now, expiresAt: new Date(now.getTime() + 60_000) });
    await putPinnedSlate(db, "sample-test", { id: "sample-test" }, now);
  }, 60_000);
  afterAll(async () => {
    await client.close();
  });

  it("stores a pinned slate with the far-future expiry and reads it back", async () => {
    const [row] = await db.select().from(slates).where(eq(slates.id, "sample-test"));
    expect(row?.expiresAt.getTime()).toBe(PINNED_EXPIRES_AT.getTime());
    expect(isPinnedExpiry(row!.expiresAt)).toBe(true);
    expect(await getSlateJson(db, "sample-test", now)).toEqual({ id: "sample-test" });
  });

  it("survives the TTL cleanup that removes expired rows, even years later", async () => {
    expect(await purgeExpiredSlates(db, now)).toBe(1);
    expect(await getSlateJson(db, "expired-slate", now)).toBeNull();
    expect(await getSlateJson(db, "live-slate", now)).not.toBeNull();
    expect(await purgeExpiredSlates(db, longAfter)).toBe(1);
    expect(await getSlateJson(db, "live-slate", longAfter)).toBeNull();
    expect(await getSlateJson(db, "sample-test", longAfter)).toEqual({ id: "sample-test" });
  });

  it("re-pinning replaces the JSON in place", async () => {
    await putPinnedSlate(db, "sample-test", { id: "sample-test", v: 2 }, now);
    expect(await getSlateJson(db, "sample-test", longAfter)).toEqual({ id: "sample-test", v: 2 });
  });
});
