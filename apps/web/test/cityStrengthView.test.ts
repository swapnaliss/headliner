import { describe, expect, it } from "vitest";
import { groupRows, initialCities, parseCityResponse, rowFromEntry, sectionStatus, type RowState } from "../src/cityStrengthView";

const ok = (city: string, mean: number, cells: number): RowState => ({ kind: "ok", city, meanAffinityRank: mean, cellCount: cells, thin: cells < 15, evidenceRefs: ["ev-1"] });

describe("initialCities", () => {
  it("puts the room city first, then the defaults, at most 5", () => {
    expect(initialCities("Berlin")).toEqual(["Berlin", "London", "Leipzig", "Jakarta", "Tromsø"]);
  });
  it("does not repeat the room city, whatever its case or accents form", () => {
    expect(initialCities("london")).toEqual(["london", "Leipzig", "Jakarta", "Tromsø"]);
    expect(initialCities("Tromsø".normalize("NFD"))).toHaveLength(4);
  });
});

describe("groupRows and sectionStatus", () => {
  it("keeps thin cities in their own group and orders by mean affinity rank", () => {
    const g = groupRows([ok("A", 0.2, 100), ok("B", 0.9, 1), ok("C", 0.5, 50), { kind: "pending", city: "D" }, { kind: "zero", city: "E", evidenceRefs: [] }, { kind: "failed", city: "F", reason: "network" }]);
    expect(g.ranked.map((r) => r.city)).toEqual(["C", "A"]);
    expect(g.thin.map((r) => r.city)).toEqual(["B"]);
    expect([g.pending.length, g.zero.length, g.failed.length]).toEqual([1, 1, 1]);
  });
  it("derives the section status", () => {
    expect(sectionStatus([{ kind: "pending", city: "A" }], false)).toBe("idle");
    expect(sectionStatus([{ kind: "pending", city: "A" }], true)).toBe("loading");
    expect(sectionStatus([ok("A", 0.5, 20)], true)).toBe("ready");
    expect(sectionStatus([ok("A", 0.5, 20), { kind: "failed", city: "B", reason: "network" }], true)).toBe("partial");
    expect(sectionStatus([{ kind: "failed", city: "B", reason: "network" }], true)).toBe("error");
    expect(sectionStatus([], true)).toBe("ready");
  });
  it("maps wire entries to rows", () => {
    expect(rowFromEntry({ city: "A", status: "no_data", reason: "zero_cells", evidenceRefs: ["e"] })).toEqual({ kind: "zero", city: "A", evidenceRefs: ["e"] });
    expect(rowFromEntry({ city: "A", status: "no_data", reason: "timeout", evidenceRefs: [] })).toEqual({ kind: "failed", city: "A", reason: "timeout" });
  });
});

describe("parseCityResponse", () => {
  const good = {
    status: "done",
    actId: "X",
    cities: [
      { city: "A", status: "ok", meanAffinityRank: 0.5, cellCount: 20, thin: false, evidenceRefs: ["e1"] },
      { city: "B", status: "no_data", reason: "shape", evidenceRefs: [] },
    ],
    caveats: [{ code: "thin_city_data", city: "C", message: "m" }, { code: "other" }, null],
    evidence: [{ id: "e1", endpoint: "/v2/insights", redactedParams: { a: "b" }, responseDigest: "d", fetchedAt: "t" }, { id: 5 }, "x"],
  };
  it("accepts a well-formed body and drops malformed evidence and caveats", () => {
    const parsed = parseCityResponse(good);
    expect(parsed?.cities).toHaveLength(2);
    expect(parsed?.caveats).toEqual([{ code: "thin_city_data", city: "C", message: "m" }]);
    expect(parsed?.evidence.map((e) => e.id)).toEqual(["e1"]);
  });
  it("rejects anything else", () => {
    for (const bad of [null, "x", [], {}, { ...good, status: "nope" }, { ...good, cities: "x" }, { ...good, cities: [null] }, { ...good, cities: [{ city: 1 }] }, { ...good, cities: [{ city: "A", status: "ok", evidenceRefs: [] }] }, { ...good, evidence: undefined }]) {
      expect(parseCityResponse(bad)).toBeNull();
    }
    expect(parseCityResponse({ ...good, actId: 3 })?.actId).toBe("");
  });
});
