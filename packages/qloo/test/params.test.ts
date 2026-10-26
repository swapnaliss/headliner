import { describe, expect, it } from "vitest";
import { createQlooClient } from "../src/client";
import { QlooBadRequest } from "../src/errors";
import { buildCompare, buildHeatmap, buildSearch, buildTrending, MAX_NAME_LENGTH } from "../src/params";
import { CROWD, fakeTransport, KHRUANGBIN, searchOk } from "./helpers";

const HOSTILE = [
  "Act&filter.type=urn:entity:place",
  "Act#fragment",
  "Act%00",
  "two  spaces and more",
  "Act=1&take=1000&signal.interests.entities=X",
  "Ünï©ode / slash ? query",
];

describe("search params are built from a typed object", () => {
  it.each(HOSTILE)("%s becomes exactly one query value and the exact expected parameter set", (name) => {
    const { endpoint, params } = buildSearch({ query: name });
    expect(endpoint).toBe("/search");
    // Build the URL as a transport would, then parse it back.
    const url = new URL(`https://example.invalid${endpoint}?${params.toString()}`);
    expect([...url.searchParams.keys()].sort()).toEqual(["query", "take", "types"]);
    expect(url.searchParams.get("query")).toBe(name.trim());
    expect(url.searchParams.get("types")).toBe("urn:entity:artist");
    expect(url.searchParams.get("take")).toBe("5");
    expect(url.hash).toBe("");
  });

  it("the sent request contains exactly that parameter set, end to end through the client", async () => {
    const t = fakeTransport(() => searchOk());
    const c = createQlooClient({ transport: t });
    await c.search("Act&filter.type=urn:entity:place");
    const sent = t.calls[0];
    expect([...(sent?.params.keys() ?? [])].sort()).toEqual(["query", "take", "types"]);
    expect(sent?.params.get("query")).toBe("Act&filter.type=urn:entity:place");
  });

  it("rejects names over 80 characters, empty names and control characters, before any call", async () => {
    const t = fakeTransport(() => searchOk());
    const c = createQlooClient({ transport: t });
    await expect(c.search("a".repeat(MAX_NAME_LENGTH + 1))).rejects.toBeInstanceOf(QlooBadRequest);
    await expect(c.search("   ")).rejects.toBeInstanceOf(QlooBadRequest);
    await expect(c.search("bad\u0000name")).rejects.toBeInstanceOf(QlooBadRequest);
    expect(t.calls.length).toBe(0);
    expect(() => buildSearch({ query: "a".repeat(MAX_NAME_LENGTH) })).not.toThrow();
  });

  it("an over-long name error does not echo the name", () => {
    const secret = "x".repeat(200);
    try {
      buildSearch({ query: secret });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain(secret);
    }
  });
});

describe("id and city params", () => {
  it("entity ids must be UUIDs, are upper-cased, de-duplicated and capped", () => {
    expect(() => buildCompare({ aIds: ["not-an-id"], bIds: [KHRUANGBIN] })).toThrow(QlooBadRequest);
    expect(() => buildCompare({ aIds: [...CROWD, "11111111-2222-3333-4444-555555555555"], bIds: [KHRUANGBIN] })).toThrow(QlooBadRequest);
    const r = buildCompare({ aIds: [...CROWD, CROWD[0]!.toLowerCase()], bIds: [KHRUANGBIN] });
    expect(r.params.get("a.signal.interests.entities")).toBe(CROWD.join(","));
    expect([...r.params.keys()]).toEqual(["a.signal.interests.entities", "b.signal.interests.entities", "filter.type"]);
  });

  it("a hostile city stays one value", () => {
    const r = buildHeatmap({ entityId: CROWD[0]!, city: "Berlin&filter.type=urn:entity:artist" });
    expect(r.params.get("filter.location.query")).toBe("Berlin&filter.type=urn:entity:artist");
    expect(r.params.get("filter.type")).toBe("urn:heatmap");
    expect([...r.params.keys()].length).toBe(3);
  });

  it("trending needs a signal and uses a 92 day window ending today (UTC)", () => {
    expect(() => buildTrending({ signalEntityIds: [] }, new Date())).toThrow(QlooBadRequest);
    const r = buildTrending({ signalEntityIds: [CROWD[0]!] }, new Date("2026-10-24T23:59:00Z"));
    expect(r.params.get("filter.end_date")).toBe("2026-10-24");
    expect(r.params.get("filter.start_date")).toBe("2026-07-24");
  });
});
