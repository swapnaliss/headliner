import { PGlite } from "@electric-sql/pglite";
import type { Db } from "@headliner/slates";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { cacheKey, InMemoryCacheStore, PostgresCacheStore, type CacheStore } from "../src/cache";
import { createQlooClient } from "../src/client";
import { QlooUnavailable } from "../src/errors";
import { CROWD, fakeTransport, fixtureBody, searchOk } from "./helpers";

vi.setConfig({ testTimeout: 30_000 }); // PGlite boots and migrates a fresh database per test

const migrationsFolder = fileURLToPath(new URL("../../slates/drizzle", import.meta.url));

async function pglite(): Promise<{ store: CacheStore; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder });
  return { store: new PostgresCacheStore(db as unknown as Db), close: () => client.close() };
}

describe.each([
  { name: "in-memory store", open: async () => ({ store: new InMemoryCacheStore() as CacheStore, close: async () => undefined }) },
  { name: "Postgres store (PGlite, migrated schema)", open: pglite },
])("cache read-through on the $name", ({ open }) => {
  it("second identical call makes zero transport calls and returns the same data and evidence", async () => {
    const { store, close } = await open();
    const t = fakeTransport(() => searchOk());
    const c = createQlooClient({ transport: t, cache: store });
    const first = await c.search("Apparat");
    const second = await c.search("Apparat");
    expect(t.calls.length).toBe(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.stale).toBe(false);
    expect(second.data).toEqual(first.data);
    expect(second.evidence).toEqual(first.evidence);
    await close();
  });

  it("a different parameter is a different key", async () => {
    const { store, close } = await open();
    const t = fakeTransport(() => searchOk());
    const c = createQlooClient({ transport: t, cache: store });
    await c.search("Apparat");
    await c.search("Moderat");
    expect(t.calls.length).toBe(2);
    await close();
  });

  it("an expired entry refetches", async () => {
    const { store, close } = await open();
    let clock = new Date("2026-10-26T10:00:00Z");
    const t = fakeTransport(() => searchOk());
    const c = createQlooClient({ transport: t, cache: store, now: () => clock, ttlSeconds: { search: 60 } });
    await c.search("Apparat");
    clock = new Date(clock.getTime() + 59_000);
    await c.search("Apparat");
    expect(t.calls.length).toBe(1);
    clock = new Date(clock.getTime() + 2_000);
    const r = await c.search("Apparat");
    expect(t.calls.length).toBe(2);
    expect(r.cached).toBe(false);
    expect(r.evidence.fetchedAt).toBe(clock.toISOString());
    await close();
  });

  it.each([
    ["503", { status: 503, body: {} }],
    ["429", { status: 429, body: {} }],
  ])("upstream %s with a stale entry present returns the stale data flagged stale: true", async (_label, failure) => {
    const { store, close } = await open();
    let clock = new Date("2026-10-26T10:00:00Z");
    let down = false;
    const t = fakeTransport(() => (down ? failure : searchOk()));
    const c = createQlooClient({ transport: t, cache: store, now: () => clock, ttlSeconds: { search: 60 }, sleep: async () => undefined });
    const fresh = await c.search("Apparat");
    clock = new Date(clock.getTime() + 3_600_000);
    down = true;
    const r = await c.search("Apparat");
    expect(r.stale).toBe(true);
    expect(r.cached).toBe(true);
    expect(r.data).toEqual(fresh.data);
    expect(r.evidence).toEqual(fresh.evidence);
    expect(c.stats().staleServed).toBe(1);
    await close();
  });

  it("upstream failure with NO cache entry raises the error", async () => {
    const { store, close } = await open();
    const t = fakeTransport(() => ({ status: 503, body: {} }));
    const c = createQlooClient({ transport: t, cache: store, sleep: async () => undefined });
    await expect(c.search("Apparat")).rejects.toBeInstanceOf(QlooUnavailable);
    await close();
  });

  it("a bad request does not fall back to stale data", async () => {
    const { store, close } = await open();
    let clock = new Date("2026-10-26T10:00:00Z");
    let bad = false;
    const t = fakeTransport(() => (bad ? { status: 400, body: {} } : searchOk()));
    const c = createQlooClient({ transport: t, cache: store, now: () => clock, ttlSeconds: { search: 1 } });
    await c.search("Apparat");
    clock = new Date(clock.getTime() + 10_000);
    bad = true;
    await expect(c.search("Apparat")).rejects.toMatchObject({ kind: "bad_request" });
    await close();
  });
});

describe("cache key", () => {
  it("is a stable hash of endpoint plus params, never the URL text", () => {
    const k = cacheKey("/search?query=Apparat&take=5&types=urn%3Aentity%3Aartist");
    expect(k).toMatch(/^qloo:v1:[0-9a-f]{64}$/);
    expect(k).toBe(cacheKey("/search?query=Apparat&take=5&types=urn%3Aentity%3Aartist"));
    expect(k).not.toContain("Apparat");
  });

  it("the stored heatmap value is the aggregate, never raw cells", async () => {
    const store = new InMemoryCacheStore();
    const t = fakeTransport(() => ({ status: 200, body: fixtureBody("heatmap--apparat-berlin.json") }));
    const c = createQlooClient({ transport: t, cache: store });
    await c.whereIsPopular(CROWD[0] as string, "Berlin");
    const stored = await store.getStale(
      cacheKey(`/v2/insights?filter.location.query=Berlin&filter.type=urn%3Aheatmap&signal.interests.entities=${encodeURIComponent(CROWD[0] as string)}`),
    );
    expect(stored).not.toBeNull();
    expect(Object.keys(stored?.data as object).sort()).toEqual(["cellCount", "droppedCells", "meanAffinityRank"]);
    expect(JSON.stringify(stored).length).toBeLessThan(1_000);
  });
});

describe("a cache failure never fails a request", () => {
  it("Postgres errors degrade to a miss and a skipped write", async () => {
    const broken = new PostgresCacheStore({
      select() {
        throw new Error("db down postgres://user:pw@host/db");
      },
      insert() {
        throw new Error("db down");
      },
    } as unknown as Db);
    const t = fakeTransport(() => searchOk());
    const c = createQlooClient({ transport: t, cache: broken });
    const r = await c.search("Apparat");
    expect(r.cached).toBe(false);
    expect(t.calls.length).toBe(1);
  });
});
