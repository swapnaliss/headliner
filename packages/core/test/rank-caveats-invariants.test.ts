import { describe, expect, it } from "vitest";
import {
  ActResultSchema,
  CAVEAT_TYPES,
  CAVEAT_WORDING,
  EvidenceInvariantError,
  LOW_MATCH_CONFIDENCE,
  RoomSchema,
  SlateSchema,
  assertEveryNumberHasEvidence,
  buildCaveats,
  computeCityStrength,
  computeFit,
  computeStanding,
  rankActs,
} from "../src";
import { actResult, cells, tags } from "./helpers";

describe("rankActs", () => {
  it("orders by fit descending and numbers scored acts from 1", () => {
    const ranked = rankActs([actResult("1", "B", 50), actResult("2", "A", 70)]);
    expect(ranked.map((r) => [r.act.name, r.rank, r.status])).toEqual([["A", 1, "scored"], ["B", 2, "scored"]]);
  });

  it("breaks fit ties by standing, then name, then entity id", () => {
    const ranked = rankActs([
      actResult("9", "Zed", 60, 10),
      actResult("2", "Amy", 60, 10),
      actResult("1", "Amy", 60, 10),
      actResult("5", "Low", 60, 5),
      actResult("6", "High", 60, 90),
      actResult("7", "Unknown", 60, null),
    ]);
    expect(ranked.map((r) => r.act.qlooEntityId)).toEqual(["6", "1", "2", "9", "5", "7"]);
  });

  it("is stable: same output for the input and its reverse and a repeat", () => {
    const input = [actResult("1", "B", 50, 20), actResult("2", "A", 50, 20), actResult("3", "C", null), actResult("4", "D", 80)];
    const out = rankActs(input).map((r) => r.act.qlooEntityId);
    expect(rankActs([...input].reverse()).map((r) => r.act.qlooEntityId)).toEqual(out);
    expect(rankActs(input)).toEqual(rankActs(input));
  });

  it("puts no-data acts last, labelled, with no rank", () => {
    const ranked = rankActs([actResult("1", "Aaa", null), actResult("2", "Zzz", 1), actResult("3", "Bbb", null)]);
    expect(ranked.map((r) => [r.act.name, r.status, r.rank])).toEqual([
      ["Zzz", "scored", 1],
      ["Aaa", "no-data", null],
      ["Bbb", "no-data", null],
    ]);
  });

  it("keeps a duplicate entity id (any case) once and does not mutate the input", () => {
    const input = [actResult("abc", "One", 60), actResult("ABC", "One again", 90)];
    const ranked = rankActs(input);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.act.name).toBe("One");
    expect(input[0]?.rank).toBeNull();
  });
});

describe("buildCaveats", () => {
  const okFit = computeFit(tags(5));
  const okStanding = computeStanding(0.5, [0.5]);
  const thin = computeCityStrength(cells(3));
  const solid = computeCityStrength(cells(20));

  it("returns nothing when everything is available and solid", () => {
    expect(buildCaveats({ fit: okFit, standing: okStanding, matchConfidence: 1, cities: [{ city: "Berlin", strength: solid }] })).toEqual([]);
  });

  it("no-data for each Fit-unavailable reason, with fixed wording", () => {
    for (const reason of ["no-shared-tags", "too-few-shared-tags", "unresolved-entity", "candidate-in-crowd"] as const) {
      const caveats = buildCaveats({ fit: { status: "unavailable", reason }, standing: okStanding });
      expect(caveats.map((c) => c.type)).toEqual(["no-data"]);
      expect(caveats[0]?.message).toContain("audience-taste fit");
    }
  });

  it("single-tag-overlap when exactly one shared tag was found", () => {
    const caveats = buildCaveats({ fit: computeFit([{ tag_id: "a", query: { score: 0.9 } }]), standing: okStanding });
    expect(caveats.map((c) => c.type)).toEqual(["no-data", "single-tag-overlap"]);
    expect(buildCaveats({ fit: computeFit(tags(2)), standing: okStanding }).map((c) => c.type)).toEqual(["no-data"]);
  });

  it("standing-unavailable when standing cannot be computed", () => {
    expect(buildCaveats({ fit: okFit, standing: computeStanding(undefined, [0.5]) }).map((c) => c.type)).toEqual([
      "standing-unavailable",
    ]);
  });

  it("low-match-confidence only below the threshold, never guessed when unknown", () => {
    const base = { fit: okFit, standing: okStanding };
    expect(buildCaveats({ ...base, matchConfidence: LOW_MATCH_CONFIDENCE - 0.01 }).map((c) => c.type)).toEqual(["low-match-confidence"]);
    expect(buildCaveats({ ...base, matchConfidence: LOW_MATCH_CONFIDENCE })).toEqual([]);
    expect(buildCaveats({ ...base, matchConfidence: null })).toEqual([]);
    expect(buildCaveats({ ...base, matchConfidence: Number.NaN })).toEqual([]);
    expect(buildCaveats(base)).toEqual([]);
  });

  it("thin-data per thin city (subject = city, sorted); no-data for a city without cells", () => {
    const caveats = buildCaveats({
      fit: okFit,
      standing: okStanding,
      cities: [
        { city: "Zurich", strength: thin },
        { city: "Berlin", strength: solid },
        { city: "Lagos", strength: computeCityStrength([]) },
        { city: "Accra", strength: thin },
      ],
    });
    expect(caveats.map((c) => [c.type, c.subject])).toEqual([
      ["thin-data", "Accra"],
      ["no-data", "Lagos"],
      ["thin-data", "Zurich"],
    ]);
  });

  it("every caveat type is covered by the tests above and wording avoids prediction language", () => {
    expect([...CAVEAT_TYPES].sort()).toEqual(
      ["low-match-confidence", "no-data", "single-tag-overlap", "standing-unavailable", "thin-data"],
    );
    for (const text of Object.values(CAVEAT_WORDING)) expect(text).not.toMatch(/forecast|turnout|will sell|predict/i);
  });
});

describe("assertEveryNumberHasEvidence", () => {
  it("passes when fit, standing and city strengths cite known evidence", () => {
    const result = actResult("1", "A", 60, 70);
    result.cityStrengths.push({ city: "Berlin", meanAffinityRank: 0.8, cellCount: 20, thinData: false, evidenceRefs: ["e1"] });
    expect(() => assertEveryNumberHasEvidence(result)).not.toThrow();
  });

  it("passes for a no-data act with no numbers", () => {
    expect(() => assertEveryNumberHasEvidence(actResult("1", "A", null))).not.toThrow();
  });

  it("throws when fit has no evidence reference", () => {
    const result = actResult("1", "A", 60);
    if (result.fit) result.fit.evidenceRefs = [];
    expect(() => assertEveryNumberHasEvidence(result)).toThrow(EvidenceInvariantError);
  });

  it("throws when standing or a city strength lacks evidence", () => {
    const noStanding = actResult("1", "A", 60, 70);
    if (noStanding.standing) noStanding.standing.evidenceRefs = [];
    expect(() => assertEveryNumberHasEvidence(noStanding)).toThrow(/standing/);
    const noCity = actResult("1", "A", 60);
    noCity.cityStrengths.push({ city: "Berlin", meanAffinityRank: 0.8, cellCount: 20, thinData: false, evidenceRefs: [] });
    expect(() => assertEveryNumberHasEvidence(noCity)).toThrow(/city strength \(Berlin\)/);
  });

  it("throws when a reference does not match an evidence entry", () => {
    const result = actResult("1", "A", 60);
    if (result.fit) result.fit.evidenceRefs = ["missing"];
    expect(() => assertEveryNumberHasEvidence(result)).toThrow(/unknown evidence "missing"/);
  });

  it("throws when overlap tags exist without a fit", () => {
    const result = actResult("1", "A", null);
    result.overlapTags.push({ tagId: "t", name: "T", score: 0.5 });
    expect(() => assertEveryNumberHasEvidence(result)).toThrow(EvidenceInvariantError);
  });
});

describe("shared zod schemas", () => {
  it("accept well-formed values and reject bad ones", () => {
    expect(ActResultSchema.safeParse(actResult("1", "A", 60, 70)).success).toBe(true);
    expect(ActResultSchema.safeParse({ ...actResult("1", "A", 60), status: "maybe" }).success).toBe(false);
    const room = { city: "Berlin", crowdActs: [{ qlooEntityId: "1", name: "A", matchConfidence: 0.9 }] };
    expect(RoomSchema.safeParse(room).success).toBe(true);
    expect(RoomSchema.safeParse({ ...room, crowdActs: [] }).success).toBe(false);
    expect(RoomSchema.safeParse({ city: "Berlin", crowdActs: [{ qlooEntityId: "1", name: "A", matchConfidence: 2 }] }).success).toBe(false);
    const slate = { id: "s1", room, results: [actResult("1", "A", 60)], createdAt: "2026-10-26T00:00:00.000Z" };
    expect(SlateSchema.safeParse(slate).success).toBe(true);
    expect(SlateSchema.safeParse({ ...slate, id: "" }).success).toBe(false);
  });
});
