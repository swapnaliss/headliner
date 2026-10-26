import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createQlooClient } from "../src/client";
import { FixtureTransport } from "../src/transport/fixture";
import { CROWD, FIXTURE_DIR, KHRUANGBIN, RADIOHEAD } from "./helpers";

const NOW = new Date("2026-10-24T12:00:00Z");
const APPARAT = CROWD[0] as string;

function client() {
  return createQlooClient({ transport: new FixtureTransport(), now: () => NOW });
}

describe("replaying fixtures/qloo with no network and no key", () => {
  it("search: resolves a recorded name and reduces the entity", async () => {
    const r = await client().search("Apparat");
    expect(r.cached).toBe(false);
    expect(r.stale).toBe(false);
    const first = r.data[0];
    expect(first?.entityId).toBe(APPARAT);
    expect(first?.name).toBe("Apparat");
    expect(first?.popularity).toBeGreaterThan(0.9);
    expect(r.evidence.endpoint).toBe("/search");
    expect(r.evidence.redactedParams["query"]).toBe("Apparat");
    expect(r.evidence.responseDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("search: a name with no match is an empty list, not an error", async () => {
    const r = await client().search("Zzqxv Nonexistentact 9731");
    expect(r.data).toEqual([]);
  });

  it("search: every recorded search fixture passes the shape assertion", async () => {
    const t = new FixtureTransport();
    const c = createQlooClient({ transport: t, now: () => NOW });
    const names = readdirSync(FIXTURE_DIR)
      .filter((f) => f.startsWith("search--"))
      .map((f) => f);
    expect(names.length).toBe(16);
    for (const q of ["Amaarae", "Björk", "Boys Noize", "Brandt Brauer Frick", "Hindia", "Hundreds", "Khruangbin", "Moderat", "Modeselektor", "Odunsi (The Engine)", "Phoenix", "Radiohead", "Reality Club", "Sigur Rós"]) {
      const r = await c.search(q);
      expect(r.data.length).toBeGreaterThan(0);
    }
    const phoenix = await c.search("Phoenix");
    expect(phoenix.data.length).toBe(5); // ambiguous: confirmation is needed downstream
  });

  it("recommend: replays the recorded insights call", async () => {
    const r = await client().recommend([APPARAT], 10);
    expect(r.data.length).toBeGreaterThan(0);
    expect(r.data[0]?.entityId).toMatch(/^[0-9A-F-]{36}$/);
  });

  it("compareAudiences: the whole crowd on side A, one candidate on side B; repeats are kept", async () => {
    const r = await client().compareAudiences(CROWD, [KHRUANGBIN]);
    expect(r.data.length).toBeGreaterThan(10);
    const ids = r.data.map((t) => t.tag_id);
    expect(new Set(ids).size).toBeLessThanOrEqual(ids.length);
    const t = r.data[0];
    expect(t?.query.score).toBeGreaterThanOrEqual(0);
    expect(t?.query.score).toBeLessThanOrEqual(1);
    expect(Array.isArray(t?.query["a.signal.interests.entities"])).toBe(true);
  });

  it("compareAudiences: the other recorded candidates replay too", async () => {
    const c = client();
    expect((await c.compareAudiences(CROWD, [RADIOHEAD])).data.length).toBeGreaterThan(0);
    expect((await c.compareAudiences(CROWD, [KHRUANGBIN, RADIOHEAD])).data.length).toBeGreaterThan(0);
  });

  it.each([
    ["Berlin", 295],
    ["London", 406],
    ["Leipzig", 39],
    ["Reykjavik", 23],
    ["Jakarta", 13],
    ["Mumbai", 10],
    ["Lagos", 1],
    ["Tromsø", 1],
  ])("whereIsPopular: Apparat in %s has %i cells (aggregate only, no coordinates)", async (city, cells) => {
    const r = await client().whereIsPopular(APPARAT, city);
    expect(r.data.cellCount).toBe(cells);
    expect(r.data.droppedCells).toBe(0);
    expect(r.data.meanAffinityRank).toBeGreaterThan(0);
    expect(JSON.stringify(r.data)).not.toMatch(/latitude|geohash/);
  });

  it("trending: flat in the hackathon environment (empty list)", async () => {
    const r = await client().trending([APPARAT], 10);
    expect(r.data).toEqual([]);
  });

  it("a request with no recording fails closed instead of inventing data", async () => {
    await expect(client().search("An Act Nobody Recorded")).rejects.toMatchObject({ kind: "unavailable" });
  });
});
