import { describe, expect, it } from "vitest";
import {
  assertEveryNumberHasEvidence,
  CAVEAT_CODES,
  CAVEAT_TEMPLATES,
  detailCaveats,
  EvidenceInvariantError,
  standingExplanationOf,
  type ActResult,
  type Caveat,
} from "../src";

const EV = (id: string) => ({ id, endpoint: "/v2/search", redactedParams: {}, responseDigest: "a".repeat(64), fetchedAt: "2026-10-26T10:00:00.000Z" });

function result(over: Partial<ActResult> = {}): ActResult {
  return {
    act: { qlooEntityId: "E1", name: "Act", matchConfidence: 1 },
    status: "scored",
    rank: 1,
    fit: { value: 60, sharedTags: 3, evidenceRefs: ["ev-c"] },
    overlapTags: [],
    standing: {
      caption: "Qloo popularity rank",
      candidatePercentile: 86.4,
      crowdMedianPercentile: 99.5,
      crowdSample: 2,
      deltaPoints: -13.1,
      label: "below",
      evidenceRefs: ["ev-a", "ev-b1", "ev-b2"],
    },
    cityStrengths: [],
    caveats: [],
    evidence: [EV("ev-c"), EV("ev-a"), EV("ev-b1"), EV("ev-b2")],
    ...over,
  };
}

describe("detailCaveats", () => {
  it("maps every stored caveat type to a code and adds standing_not_capacity when a standing is shown", () => {
    const caveats: Caveat[] = [
      { type: "no-data", message: "n" },
      { type: "low-match-confidence", message: "ignored free text" },
      { type: "thin-data", message: "ignored free text", subject: "Lagos" },
      { type: "standing-unavailable", message: "s" },
      { type: "single-tag-overlap", message: "one" },
    ];
    const out = detailCaveats({ caveats, standing: {} });
    expect(out.map((c) => c.code)).toEqual(["no_data", "low_match_confidence", "thin_city_data", "no_data", "no_data", "standing_not_capacity"]);
    expect(out[1]?.message).toBe(CAVEAT_TEMPLATES.low_match_confidence);
    expect(out[2]).toEqual({ code: "thin_city_data", message: CAVEAT_TEMPLATES.thin_city_data, subject: "Lagos" });
  });

  it("has no standing_not_capacity without a standing, and the code set is fixed", () => {
    expect(detailCaveats({ caveats: [], standing: null })).toEqual([]);
    expect([...CAVEAT_CODES]).toEqual(["no_data", "low_match_confidence", "thin_city_data", "standing_not_capacity"]);
  });

  it("fixed templates avoid forecast wording and name a standing, not capacity", () => {
    const text = Object.values(CAVEAT_TEMPLATES).join(" ");
    expect(text).not.toMatch(/forecast|turnout|will sell/i);
    expect(CAVEAT_TEMPLATES.standing_not_capacity).toContain("not a measure of change over time or room size");
  });
});

describe("standingExplanationOf", () => {
  it("derives candidate and crowd evidence from the standing refs when none is stored", () => {
    expect(standingExplanationOf(result())).toEqual({
      candidatePercentile: 86.4,
      crowdMedianPercentile: 99.5,
      crowdSample: 2,
      candidateEvidenceRef: "ev-a",
      crowdEvidenceRefs: ["ev-b1", "ev-b2"],
    });
  });
  it("prefers the stored one and is null without a standing", () => {
    const stored = { candidatePercentile: 1, crowdMedianPercentile: 2, crowdSample: 1, candidateEvidenceRef: "x", crowdEvidenceRefs: ["y"] };
    expect(standingExplanationOf(result({ standingExplanation: stored }))).toBe(stored);
    expect(standingExplanationOf(result({ standing: null }))).toBeNull();
  });
});

describe("assertEveryNumberHasEvidence with a standing explanation", () => {
  it("accepts known refs and rejects an unknown one", () => {
    const ok = { candidatePercentile: 1, crowdMedianPercentile: 2, crowdSample: 1, candidateEvidenceRef: "ev-a", crowdEvidenceRefs: ["ev-b1"] };
    expect(() => assertEveryNumberHasEvidence(result({ standingExplanation: ok }))).not.toThrow();
    expect(() => assertEveryNumberHasEvidence(result({ standingExplanation: { ...ok, crowdEvidenceRefs: ["ev-missing"] } }))).toThrow(EvidenceInvariantError);
  });
});
