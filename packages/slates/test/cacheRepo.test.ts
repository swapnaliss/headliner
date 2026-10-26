import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getCache, getStale, purgeExpired, putCache } from "../src/db/cacheRepo";
import { closeDb, DatabaseUnavailable, getDb, type Db } from "../src/db/client";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

interface Target {
  name: string;
  open: () => Promise<{ db: Db; close: () => Promise<void> }>;
}

const targets: Target[] = [
  {
    name: "ephemeral Postgres (PGlite)",
    open: async () => {
      const client = new PGlite();
      const db = drizzlePglite(client);
      await migrate(db, { migrationsFolder });
      return { db: db as unknown as Db, close: () => client.close() };
    },
  },
];

// Against a real database (Neon) too, when a URL is supplied. Rows use a unique key prefix and are removed.
if (process.env["DATABASE_URL"]) {
  targets.push({
    name: "DATABASE_URL (Neon)",
    open: async () => ({ db: getDb(), close: () => closeDb() }),
  });
}

describe.each(targets)("cacheRepo on $name", (target) => {
  let db: Db;
  let close: () => Promise<void>;
  const p = `m0-05-test-${Date.now()}-`;
  const t0 = new Date("2026-01-01T00:00:00Z");

  beforeAll(async () => {
    ({ db, close } = await target.open());
  });
  afterAll(async () => {
    await db.execute(sql`delete from qloo_cache where key like ${p + "%"}`);
    await close();
  });

  it("writes then reads a hit", async () => {
    await putCache(db, p + "hit", { a: 1 }, 60, t0);
    const row = await getCache<{ a: number }>(db, p + "hit", new Date(t0.getTime() + 30_000));
    expect(row?.json).toEqual({ a: 1 });
    expect(row?.expiresAt.getTime()).toBe(t0.getTime() + 60_000);
  });

  it("returns a miss for an absent key", async () => {
    expect(await getCache(db, p + "absent")).toBeNull();
    expect(await getStale(db, p + "absent")).toBeNull();
  });

  it("does not return an expired row from getCache but does from getStale", async () => {
    await putCache(db, p + "old", { stale: true }, 10, t0);
    const later = new Date(t0.getTime() + 11_000);
    expect(await getCache(db, p + "old", later)).toBeNull();
    expect((await getStale<{ stale: boolean }>(db, p + "old"))?.json).toEqual({ stale: true });
  });

  it("upsert overwrites value and expiry", async () => {
    await putCache(db, p + "up", { v: 1 }, 10, t0);
    await putCache(db, p + "up", { v: 2 }, 100, t0);
    const row = await getCache<{ v: number }>(db, p + "up", new Date(t0.getTime() + 50_000));
    expect(row?.json).toEqual({ v: 2 });
  });

  it("purgeExpired removes only expired rows", async () => {
    const now = new Date();
    await putCache(db, p + "gone", { x: 1 }, -5, now);
    await putCache(db, p + "kept", { x: 2 }, 3600, now);
    const removed = await purgeExpired(db, now);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await getStale(db, p + "gone")).toBeNull();
    expect(await getCache(db, p + "kept", now)).not.toBeNull();
  });
});

describe("migrations", () => {
  it("apply to an empty database and a second application is a no-op", async () => {
    const client = new PGlite();
    const db = drizzlePglite(client);
    await migrate(db, { migrationsFolder });
    await migrate(db, { migrationsFolder });
    const res = await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    const names = (res.rows as { table_name: string }[]).map((r) => r.table_name);
    expect(names).toEqual(["budgets", "qloo_cache", "slates"]);
    await client.close();
  });
});

describe("client without DATABASE_URL", () => {
  it("imports fine and throws DatabaseUnavailable only when asked for a connection", () => {
    expect(() => getDb({})).toThrow(DatabaseUnavailable);
    expect(() => getDb({ DATABASE_URL: "" })).toThrow(DatabaseUnavailable);
  });
});
