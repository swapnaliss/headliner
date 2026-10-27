import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createQlooClient, FixtureTransport, InMemoryCacheStore } from "@headliner/qloo";
import { purgeExpiredSlates, putPinnedSlate, slates, type Db } from "@headliner/slates";
import { MIN_CANDIDATE_ACTS, MIN_CROWD_ACTS } from "@headliner/core";
import { buildRuntime } from "../src/config";
import { isSampleId, loadSampleRooms, sampleId, sampleLinks, SampleRoomsSchema, buildSampleSlate, FixtureSampleStore } from "../src/samples";
import { isSlateId, MemorySlateStore, newSlateId, PostgresSlateStore } from "../src/slateStore";
import { counting, FIXTURE_DIR } from "./helpers";

const migrationsFolder = fileURLToPath(new URL("../../../packages/slates/drizzle", import.meta.url));

describe("rooms.json", () => {
  const rooms = loadSampleRooms();

  it("validates against the room schema: 2 or 3 rooms, 3 to 6 crowd acts, 3 or more candidates", () => {
    expect(SampleRoomsSchema.safeParse(rooms).success).toBe(true);
    expect(rooms.length).toBeGreaterThanOrEqual(2);
    expect(rooms.length).toBeLessThanOrEqual(3);
    for (const r of rooms) {
      expect(r.crowdActs.length).toBeGreaterThanOrEqual(MIN_CROWD_ACTS);
      expect(r.crowdActs.length).toBeLessThanOrEqual(6);
      expect(r.candidateActs.length).toBeGreaterThanOrEqual(MIN_CANDIDATE_ACTS);
    }
  });

  it("rejects an invalid slug, a fourth room, a duplicate slug and an unknown field", () => {
    const first = rooms[0]!;
    expect(SampleRoomsSchema.safeParse([{ ...first, slug: "Bad Slug" }, rooms[1]]).success).toBe(false);
    expect(SampleRoomsSchema.safeParse([first, rooms[1], rooms[0], rooms[1]]).success).toBe(false);
    expect(SampleRoomsSchema.safeParse([first, { ...first }]).success).toBe(false);
    expect(SampleRoomsSchema.safeParse([first, { ...rooms[1], extra: 1 }]).success).toBe(false);
  });

  it("every name resolves to an exact top hit in the recordings, and every candidate is scored", async () => {
    for (const room of rooms) {
      const at = new Date(`${room.recordedOn}T12:00:00.000Z`);
      const client = createQlooClient({ transport: new FixtureTransport(FIXTURE_DIR), cache: new InMemoryCacheStore(), now: () => at });
      const { slate } = await buildSampleSlate(room, client, "fixtures", () => at);
      expect(slate.id).toBe(sampleId(room.slug));
      expect(slate.results).toHaveLength(room.candidateActs.length);
      expect(slate.results.every((r) => r.status === "scored")).toBe(true);
      expect(slate.results[0]?.cityStrengths.length).toBeGreaterThan(0);
    }
  }, 30_000);
});

describe("sample ids", () => {
  it("accepts sample-<slug> and rejects look-alikes; ordinary ids stay nanoid 21", () => {
    expect(isSampleId("sample-berlin-electronic")).toBe(true);
    for (const bad of ["sample-", "sample--x", "sample-X", "sample-a/b", "sample-a b", "Sample-a", "sample-" + "a".repeat(60), "sample-a?b=1"]) {
      expect(isSampleId(bad)).toBe(false);
      expect(isSlateId(bad)).toBe(false);
    }
    expect(isSlateId(newSlateId())).toBe(true);
    expect(isSlateId("short")).toBe(false);
  });

  it("lists links to /s/sample-<slug> with the recording day", () => {
    const links = sampleLinks();
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const l of links) {
      expect(l.href).toBe(`/s/sample-${l.slug}`);
      expect(l.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("fixtures mode serves the samples with no key and no database", () => {
  it("opens each sample from the recordings, and an unknown sample id is simply not found", async () => {
    const rt = buildRuntime({ DEMO_MODE: "fixtures", FIXTURES_DIR: FIXTURE_DIR });
    for (const l of sampleLinks()) {
      const slate = await rt.store.get(`sample-${l.slug}`);
      expect(slate?.id).toBe(`sample-${l.slug}`);
      expect(slate?.results.length).toBeGreaterThan(0);
    }
    expect(await rt.store.get("sample-no-such-room")).toBeNull();
    expect(rt.store).toBeInstanceOf(FixtureSampleStore);
  }, 30_000);

  it("a request cannot create a sample id: only the store's own samples exist", async () => {
    const inner = new MemorySlateStore();
    const store = new FixtureSampleStore(inner, FIXTURE_DIR);
    expect(await inner.get("sample-berlin-electronic")).toBeNull();
    expect(await store.get("sample-berlin-electronic")).not.toBeNull();
  }, 30_000);
});

describe("pinned samples in Postgres (PGlite): zero Qloo calls and they survive TTL cleanup", () => {
  let client: PGlite;
  let db: Db;
  const now = new Date("2026-10-27T12:00:00.000Z");

  beforeAll(async () => {
    client = new PGlite();
    const pg = drizzlePglite(client);
    await migrate(pg, { migrationsFolder });
    db = pg as unknown as Db;
    const room = loadSampleRooms()[0]!;
    const at = new Date(`${room.recordedOn}T12:00:00.000Z`);
    const built = await buildSampleSlate(room, createQlooClient({ transport: new FixtureTransport(FIXTURE_DIR), cache: new InMemoryCacheStore(), now: () => at }), "fixtures", () => at);
    await putPinnedSlate(db, sampleId(room.slug), built.slate, now);
    await db.insert(slates).values({ id: "ordinary-expired-0001", json: {}, createdAt: now, expiresAt: new Date(now.getTime() - 1) });
  }, 60_000);
  afterAll(async () => {
    await client.close();
  });

  it("reads a pinned sample through the store with a transport call counter of 0", async () => {
    const transport = counting(new FixtureTransport(FIXTURE_DIR));
    const qloo = createQlooClient({ transport, cache: new InMemoryCacheStore() });
    const store = new PostgresSlateStore(db, () => now);
    const slug = loadSampleRooms()[0]!.slug;
    const slate = await store.get(sampleId(slug));
    expect(slate?.id).toBe(sampleId(slug));
    expect(slate?.results.length).toBeGreaterThan(0);
    expect(transport.calls).toHaveLength(0);
    expect(qloo.stats().liveCalls).toBe(0);
  });

  it("a simulated TTL cleanup removes expired rows and leaves the pinned sample, years later", async () => {
    expect(await purgeExpiredSlates(db, now)).toBe(1);
    const years = new Date("2031-06-01T00:00:00.000Z");
    expect(await purgeExpiredSlates(db, years)).toBe(0);
    const store = new PostgresSlateStore(db, () => years);
    expect(await store.get(sampleId(loadSampleRooms()[0]!.slug))).not.toBeNull();
  });
});
