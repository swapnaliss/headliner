import { describe, expect, it } from "vitest";
import {
  FIT_MIN_SHARED_TAGS,
  STANDING_CAPTION,
  THIN_DATA_CELLS,
  computeCityStrength,
  computeFit,
  computeStanding,
  fitForCandidate,
  rankByFit,
  type CompareTag,
  type FitResult,
  type HeatmapCell,
} from "../src/scoring";
import crowdVsKhruangbin from "../../../fixtures/qloo/compare--list6-crowd-vs-khruangbin.json";
import crowdVsRadiohead from "../../../fixtures/qloo/compare--list6-crowd-vs-radiohead.json";
import crowdVsRealityClub from "../../../fixtures/qloo/compare--list6-crowd-vs-reality-club.json";
import heatmapBerlin from "../../../fixtures/qloo/heatmap--apparat-berlin.json";
import heatmapLagos from "../../../fixtures/qloo/heatmap--apparat-lagos.json";
import heatmapLeipzig from "../../../fixtures/qloo/heatmap--apparat-leipzig.json";

function tag(id: string, score: number, acts: readonly string[] = ["A"]): CompareTag {
  return { tag_id: id, query: { score, "a.signal.interests.entities": acts.map((entity_id) => ({ entity_id })) } };
}
function tags(n: number, score = 0.6): CompareTag[] {
  return Array.from({ length: n }, (_, i) => tag(`t${i}`, score));
}
function cells(n: number, rank = 0.5): HeatmapCell[] {
  return Array.from({ length: n }, () => ({ query: { affinity_rank: rank } }));
}
function ok(result: FitResult): number {
  if (result.status !== "ok") throw new Error(`expected ok, got ${result.reason}`);
  return result.fit;
}
const compareTags = (fixture: unknown): CompareTag[] =>
  (fixture as { body: { results: { tags: CompareTag[] } } }).body.results.tags;
const heatmapCells = (fixture: unknown): HeatmapCell[] =>
  (fixture as { body: { results: { heatmap: HeatmapCell[] } } }).body.results.heatmap;

describe("computeFit", () => {
  it("is the mean of shared-tag scores x 100, one decimal", () => {
    expect(ok(computeFit([tag("a", 0.5), tag("b", 0.6), tag("c", 0.7)]))).toBe(60);
    expect(ok(computeFit([tag("a", 0.5), tag("b", 0.5), tag("c", 0.51)]))).toBe(50.3);
  });

  it("edge: empty tags give unavailable, not zero", () => {
    expect(computeFit([])).toEqual({ status: "unavailable", reason: "no-shared-tags" });
    expect(computeFit(null)).toEqual({ status: "unavailable", reason: "no-shared-tags" });
  });

  it("edge: one shared tag only is below the minimum", () => {
    expect(FIT_MIN_SHARED_TAGS).toBe(3);
    expect(computeFit([tag("a", 0.9)])).toEqual({ status: "unavailable", reason: "too-few-shared-tags" });
    expect(computeFit([tag("a", 0.9), tag("b", 0.9)]).status).toBe("unavailable");
    expect(computeFit([tag("a", 0.9), tag("b", 0.9), tag("c", 0.9)]).status).toBe("ok");
  });

  it("edge: non-finite or out-of-range scores are dropped and counted", () => {
    const result = computeFit([
      ...tags(3, 0.6),
      tag("nan", Number.NaN),
      tag("inf", Number.POSITIVE_INFINITY),
      tag("neg", -0.1),
      tag("big", 1.2),
    ]);
    expect(result).toEqual({ status: "ok", fit: 60, sharedTags: 3, droppedTags: 4 });
  });

  it("edge: only unusable scores means unavailable", () => {
    expect(computeFit([tag("a", Number.NaN), tag("b", 2), tag("c", -1)]).status).toBe("unavailable");
  });

  it("de-duplicates repeated tag ids using the repeat that covers the most crowd acts", () => {
    const result = computeFit([
      tag("g", 0.9, ["A"]),
      tag("g", 0.5, ["A", "B", "C"]),
      tag("h", 0.6, ["A", "A"]),
      tag("i", 0.7, ["A"]),
    ]);
    expect(result).toEqual({ status: "ok", fit: 60, sharedTags: 3, droppedTags: 0 });
  });

  it("breaks a coverage tie with the higher score", () => {
    const result = computeFit([tag("g", 0.5, ["A"]), tag("g", 0.8, ["B"]), tag("h", 0.5), tag("i", 0.5)]);
    expect(ok(result)).toBe(60);
  });

  it("is independent of tag order", () => {
    const forward = [tag("a", 0.51), tag("b", 0.62), tag("c", 0.73), tag("d", 0.84)];
    expect(computeFit([...forward].reverse())).toEqual(computeFit(forward));
  });

  it("determinism: same input twice gives identical output (recorded compare results)", () => {
    for (const fixture of [crowdVsKhruangbin, crowdVsRadiohead, crowdVsRealityClub]) {
      expect(computeFit(compareTags(fixture))).toEqual(computeFit(compareTags(fixture)));
    }
  });

  it("recorded Khruangbin compare gives a fit in range with 46 distinct tags", () => {
    const result = computeFit(compareTags(crowdVsKhruangbin));
    expect(result).toMatchObject({ status: "ok", sharedTags: 46, droppedTags: 0 });
    expect(ok(result)).toBeGreaterThanOrEqual(0);
    expect(ok(result)).toBeLessThanOrEqual(100);
  });
});

describe("fitForCandidate", () => {
  const crowd = ["AAA-1", "BBB-2"];
  it("edge: unresolved entity is unavailable (no data, never a zero)", () => {
    expect(fitForCandidate({ candidateId: null, crowdIds: crowd, tags: tags(5) })).toEqual({
      status: "unavailable",
      reason: "unresolved-entity",
    });
    expect(fitForCandidate({ candidateId: "CCC-3", crowdIds: crowd, tags: null }).status).toBe("unavailable");
  });
  it("edge: a candidate equal to a crowd act is unavailable, ignoring id case", () => {
    expect(fitForCandidate({ candidateId: "aaa-1", crowdIds: crowd, tags: tags(5) })).toEqual({
      status: "unavailable",
      reason: "candidate-in-crowd",
    });
  });
  it("scores a resolved, distinct candidate", () => {
    expect(ok(fitForCandidate({ candidateId: "CCC-3", crowdIds: crowd, tags: tags(5, 0.7) }))).toBe(70);
  });
});

describe("rankByFit", () => {
  const scored = (entityId: string, name: string, fit: number) => ({
    entityId,
    name,
    fit: { status: "ok", fit, sharedTags: 5, droppedTags: 0 } as FitResult,
  });
  const none = (entityId: string, name: string) => ({
    entityId,
    name,
    fit: { status: "unavailable", reason: "x" } as FitResult,
  });

  it("orders by fit descending and numbers from 1", () => {
    const ranked = rankByFit([scored("1", "B", 50), scored("2", "A", 70)]);
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([["A", 1], ["B", 2]]);
  });

  it("edge: ties break by name, then entity id, stably", () => {
    const ranked = rankByFit([scored("9", "Zed", 60), scored("2", "Amy", 60), scored("1", "Amy", 60)]);
    expect(ranked.map((r) => r.entityId)).toEqual(["1", "2", "9"]);
    expect(rankByFit([...ranked].reverse()).map((r) => r.entityId)).toEqual(["1", "2", "9"]);
  });

  it("edge: unavailable candidates sort after scored ones, never as zero", () => {
    const ranked = rankByFit([none("1", "Aaa"), scored("2", "Zzz", 1)]);
    expect(ranked.map((r) => r.name)).toEqual(["Zzz", "Aaa"]);
  });

  it("edge: a duplicate candidate (same id, any case) is kept once", () => {
    const ranked = rankByFit([scored("abc", "One", 60), scored("ABC", "One again", 90)]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.name).toBe("One");
  });

  it("determinism: same input twice gives identical output", () => {
    const input = [scored("1", "B", 50), scored("2", "A", 50), none("3", "C")];
    expect(rankByFit(input)).toEqual(rankByFit(input));
  });
});

describe("computeStanding", () => {
  it("compares the candidate with the crowd median and labels it", () => {
    const above = computeStanding(0.95, [0.5, 0.6, 0.7]);
    expect(above).toMatchObject({
      status: "ok",
      caption: STANDING_CAPTION,
      candidatePercentile: 95,
      crowdMedianPercentile: 60,
      crowdSample: 3,
      deltaPoints: 35,
      label: "above",
    });
    expect(computeStanding(0.2, [0.5, 0.6, 0.7])).toMatchObject({ label: "below", deltaPoints: -40 });
    expect(computeStanding(0.62, [0.5, 0.6, 0.7])).toMatchObject({ label: "similar" });
  });

  it("uses the mean of the two middle values for an even crowd", () => {
    expect(computeStanding(0.5, [0.4, 0.6])).toMatchObject({ crowdMedianPercentile: 50, label: "similar" });
  });

  it("thresholds: exactly 5 points is similar, just over is above or below", () => {
    expect(computeStanding(0.65, [0.6])).toMatchObject({ deltaPoints: 5, label: "similar" });
    expect(computeStanding(0.651, [0.6])).toMatchObject({ deltaPoints: 5.1, label: "above" });
    expect(computeStanding(0.55, [0.6])).toMatchObject({ deltaPoints: -5, label: "similar" });
    expect(computeStanding(0.549, [0.6])).toMatchObject({ deltaPoints: -5.1, label: "below" });
  });

  it("edge: missing popularity on the candidate is unavailable", () => {
    expect(computeStanding(undefined, [0.5])).toEqual({ status: "unavailable", reason: "candidate-popularity-missing" });
    expect(computeStanding(null, [0.5]).status).toBe("unavailable");
    expect(computeStanding(Number.NaN, [0.5]).status).toBe("unavailable");
  });

  it("edge: missing popularity on some crowd acts uses the rest and reports the sample", () => {
    expect(computeStanding(0.6, [0.6, undefined, null, 2])).toMatchObject({ crowdSample: 1, label: "similar" });
  });

  it("edge: all crowd acts missing popularity is unavailable", () => {
    expect(computeStanding(0.6, [undefined, null])).toEqual({ status: "unavailable", reason: "crowd-popularity-missing" });
    expect(computeStanding(0.6, [])).toEqual({ status: "unavailable", reason: "crowd-popularity-missing" });
  });

  it("determinism: same input twice gives identical output, whatever the crowd order", () => {
    expect(computeStanding(0.9, [0.3, 0.8, 0.5])).toEqual(computeStanding(0.9, [0.8, 0.5, 0.3]));
  });
});

describe("computeCityStrength", () => {
  it("returns mean affinity_rank and cell count", () => {
    expect(computeCityStrength([{ query: { affinity_rank: 0.2 } }, { query: { affinity_rank: 0.4 } }])).toEqual({
      status: "ok",
      meanAffinityRank: 0.3,
      cellCount: 2,
      droppedCells: 0,
      thinData: true,
    });
  });

  it("edge: zero cells is unavailable, not a zero strength", () => {
    expect(computeCityStrength([])).toEqual({ status: "unavailable", reason: "zero-cells" });
    expect(computeCityStrength(undefined).status).toBe("unavailable");
  });

  it("edge: exactly 14 cells is thin data, exactly 15 is not", () => {
    expect(THIN_DATA_CELLS).toBe(15);
    expect(computeCityStrength(cells(14))).toMatchObject({ cellCount: 14, thinData: true });
    expect(computeCityStrength(cells(15))).toMatchObject({ cellCount: 15, thinData: false });
  });

  it("edge: cells with a missing or invalid affinity_rank are dropped and not counted", () => {
    const result = computeCityStrength([
      ...cells(15, 0.6),
      {},
      { query: {} },
      { query: { affinity_rank: null } },
      { query: { affinity_rank: Number.NaN } },
      { query: { affinity_rank: 1.5 } },
    ]);
    expect(result).toEqual({ status: "ok", meanAffinityRank: 0.6, cellCount: 15, droppedCells: 5, thinData: false });
  });

  it("edge: when every cell lacks a rank it is unavailable", () => {
    expect(computeCityStrength([{}, { query: {} }]).status).toBe("unavailable");
  });

  it("determinism and order independence", () => {
    const input = [0.91, 0.12, 0.55, 0.33].map((r) => ({ query: { affinity_rank: r } }));
    expect(computeCityStrength(input)).toEqual(computeCityStrength([...input].reverse()));
    expect(computeCityStrength(input)).toEqual(computeCityStrength(input));
  });

  it("recorded Apparat heatmaps: Berlin and Leipzig are not thin, Lagos is", () => {
    expect(computeCityStrength(heatmapCells(heatmapBerlin))).toMatchObject({ cellCount: 295, thinData: false });
    expect(computeCityStrength(heatmapCells(heatmapLeipzig))).toMatchObject({ cellCount: 39, thinData: false });
    expect(computeCityStrength(heatmapCells(heatmapLagos))).toMatchObject({ cellCount: 1, thinData: true });
  });
});
