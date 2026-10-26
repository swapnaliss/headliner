import { describe, expect, it } from "vitest";
import { createQlooClient } from "../src/client";
import { fetchHeatmap } from "../src/heatmap";
import { FixtureTransport } from "../src/transport/fixture";
import { CROWD, fakeTransport, fixtureBody } from "./helpers";

const NOW = new Date("2026-10-26T12:00:00Z");
const APPARAT = CROWD[0] as string;
const REALITY_CLUB = "D717D5F9-262C-4CB0-82EE-BBCEB4B3C992";

function fixtureClient() {
  return createQlooClient({ transport: new FixtureTransport(), now: () => NOW });
}

describe("fetchHeatmap", () => {
  it("returns the aggregate and redacted Evidence for a recorded city (no coordinates)", async () => {
    const out = await fetchHeatmap(fixtureClient(), { entityId: APPARAT, city: "London" });
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.aggregate.cellCount).toBe(406);
    expect(out.aggregate.meanAffinityRank).toBeGreaterThan(0.59);
    expect(out.aggregate.meanAffinityRank).toBeLessThan(0.61);
    expect(JSON.stringify(out)).not.toMatch(/latitude|longitude|geohash|"heatmap"/);
    expect(out.evidence.endpoint).toBe("/v2/insights");
    expect(out.evidence.redactedParams).toEqual({
      "filter.location.query": "London",
      "filter.type": "urn:heatmap",
      "signal.interests.entities": APPARAT,
    });
  });

  it("a city with no cells is ok with zero cells and no mean (the caller shows no data)", async () => {
    const out = await fetchHeatmap(fixtureClient(), { entityId: REALITY_CLUB, city: "Tromsø" });
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.aggregate).toEqual({ cellCount: 0, droppedCells: 0, meanAffinityRank: null });
  });

  it("a response without results.heatmap fails the shape assertion and yields no_data, not a crash", async () => {
    const t = fakeTransport(() => ({ status: 200, body: { success: true, results: {} } }));
    const c = createQlooClient({ transport: t, now: () => NOW });
    const out = await fetchHeatmap(c, { entityId: APPARAT, city: "Berlin" });
    expect(out).toEqual({ status: "no_data", city: "Berlin", reason: "shape" });
    // a malformed answer is not cached: the next call goes upstream again
    await fetchHeatmap(c, { entityId: APPARAT, city: "Berlin" });
    expect(t.calls).toHaveLength(2);
  });

  it("other bodies that are not a heatmap also yield no_data", async () => {
    for (const body of [null, "<html>", [], { success: true, results: { heatmap: "none" } }, { success: false, results: { heatmap: [] } }]) {
      const t = fakeTransport(() => ({ status: 200, body }));
      const out = await fetchHeatmap(createQlooClient({ transport: t, now: () => NOW }), { entityId: APPARAT, city: "Berlin" });
      expect(out.status).toBe("no_data");
    }
  });

  it("maps upstream failures to no_data with the error kind and no upstream text", async () => {
    const t = fakeTransport(() => ({ status: 400, body: { errors: ["secret upstream text"] } }));
    const out = await fetchHeatmap(createQlooClient({ transport: t, now: () => NOW }), { entityId: APPARAT, city: "Berlin" });
    expect(out).toEqual({ status: "no_data", city: "Berlin", reason: "bad_request" });
    expect(JSON.stringify(out)).not.toContain("secret");
  });

  it("a recording that does not exist is no_data (unavailable)", async () => {
    const out = await fetchHeatmap(fixtureClient(), { entityId: APPARAT, city: "Atlantis" });
    expect(out).toEqual({ status: "no_data", city: "Atlantis", reason: "unavailable" });
  });

  it("an invalid city is no_data (bad_request) and makes no call", async () => {
    const t = fakeTransport(() => ({ status: 200, body: fixtureBody("heatmap--apparat-berlin.json") }));
    const out = await fetchHeatmap(createQlooClient({ transport: t, now: () => NOW }), { entityId: APPARAT, city: "x".repeat(81) });
    expect(out).toEqual({ status: "no_data", city: "x".repeat(81), reason: "bad_request" });
    expect(t.calls).toHaveLength(0);
  });

  it("builds the three parameters from a typed object: a hostile city stays one value", async () => {
    const t = fakeTransport(() => ({ status: 200, body: fixtureBody("heatmap--apparat-berlin.json") }));
    await fetchHeatmap(createQlooClient({ transport: t, now: () => NOW }), { entityId: APPARAT, city: "Berlin&filter.type=urn:entity:artist#x" });
    const req = t.calls[0];
    expect(req?.endpoint).toBe("/v2/insights");
    const params = new URLSearchParams(req?.params);
    expect([...params.keys()].sort()).toEqual(["filter.location.query", "filter.type", "signal.interests.entities"]);
    expect(params.get("filter.location.query")).toBe("Berlin&filter.type=urn:entity:artist#x");
    expect(params.get("filter.type")).toBe("urn:heatmap");
  });

  it("serves a second identical call from the cache (read-through)", async () => {
    const c = fixtureClient();
    const first = await fetchHeatmap(c, { entityId: APPARAT, city: "Leipzig" });
    const second = await fetchHeatmap(c, { entityId: APPARAT, city: "Leipzig" });
    if (first.status !== "ok" || second.status !== "ok") throw new Error("expected ok");
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.aggregate).toEqual(first.aggregate);
    expect(second.evidence).toEqual(first.evidence);
  });

  it("rethrows an error that is not a Qloo error", async () => {
    const boom = { whereIsPopular: () => Promise.reject(new TypeError("bug")) };
    await expect(fetchHeatmap(boom, { entityId: APPARAT, city: "Berlin" })).rejects.toThrow("bug");
  });
});
