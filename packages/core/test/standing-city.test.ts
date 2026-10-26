import { describe, expect, it } from "vitest";
import { STANDING_CAPTION, THIN_DATA_CELLS, computeCityStrength, computeStanding } from "../src";
import { cells, crowdPopularity, heatmapCells, popularityOf } from "./helpers";

describe("computeStanding", () => {
  it("compares the candidate with the crowd median and labels it", () => {
    expect(computeStanding(0.95, [0.5, 0.6, 0.7])).toMatchObject({
      status: "ok",
      caption: STANDING_CAPTION,
      candidatePercentile: 95,
      crowdMedianPercentile: 60,
      crowdSample: 3,
      deltaPoints: 35,
      label: "above",
    });
    expect(STANDING_CAPTION).toBe("Qloo popularity rank");
    expect(computeStanding(0.2, [0.5, 0.6, 0.7])).toMatchObject({ label: "below", deltaPoints: -40 });
    expect(computeStanding(0.62, [0.5, 0.6, 0.7])).toMatchObject({ label: "similar" });
  });

  it("uses the mean of the two middle values for an even crowd", () => {
    expect(computeStanding(0.5, [0.4, 0.6])).toMatchObject({ crowdMedianPercentile: 50, label: "similar" });
  });

  it("edge crowd of one: the median is that act", () => {
    expect(computeStanding(0.9, [0.6])).toMatchObject({ crowdSample: 1, crowdMedianPercentile: 60, label: "above" });
  });

  it("thresholds: exactly 5 points is similar, just over is above or below", () => {
    expect(computeStanding(0.65, [0.6])).toMatchObject({ deltaPoints: 5, label: "similar" });
    expect(computeStanding(0.651, [0.6])).toMatchObject({ deltaPoints: 5.1, label: "above" });
    expect(computeStanding(0.55, [0.6])).toMatchObject({ deltaPoints: -5, label: "similar" });
    expect(computeStanding(0.549, [0.6])).toMatchObject({ deltaPoints: -5.1, label: "below" });
  });

  it("edge candidate popularity missing: unavailable with a reason", () => {
    expect(computeStanding(undefined, [0.5])).toEqual({ status: "unavailable", reason: "candidate-popularity-missing" });
    expect(computeStanding(null, [0.5]).status).toBe("unavailable");
    expect(computeStanding(Number.NaN, [0.5]).status).toBe("unavailable");
  });

  it("edge some crowd popularity missing: uses the rest and reports the sample", () => {
    expect(computeStanding(0.6, [0.6, undefined, null, 2])).toMatchObject({ crowdSample: 1, label: "similar" });
  });

  it("edge all crowd popularity missing: unavailable", () => {
    expect(computeStanding(0.6, [undefined, null])).toEqual({ status: "unavailable", reason: "crowd-popularity-missing" });
    expect(computeStanding(0.6, [])).toEqual({ status: "unavailable", reason: "crowd-popularity-missing" });
  });

  it("is deterministic whatever the crowd order", () => {
    expect(computeStanding(0.9, [0.3, 0.8, 0.5])).toEqual(computeStanding(0.9, [0.8, 0.5, 0.3]));
  });

  it("recorded searches match the values in ADR 0013", () => {
    const crowd = crowdPopularity();
    const expected: [string, number, number, string][] = [
      ["reality-club", 86.4, -13.1, "below"],
      ["radiohead", 100, 0.5, "similar"],
      ["khruangbin", 99.2, -0.3, "similar"],
    ];
    for (const [slug, percentile, delta, label] of expected) {
      expect(computeStanding(popularityOf(slug), crowd)).toMatchObject({
        status: "ok",
        candidatePercentile: percentile,
        crowdMedianPercentile: 99.5,
        crowdSample: 6,
        deltaPoints: delta,
        label,
      });
    }
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

  it("edge zero cells: unavailable, not a zero strength", () => {
    expect(computeCityStrength([])).toEqual({ status: "unavailable", reason: "zero-cells" });
    expect(computeCityStrength(undefined).status).toBe("unavailable");
  });

  it("thin: 14 cells is thin data, 15 is not", () => {
    expect(THIN_DATA_CELLS).toBe(15);
    expect(computeCityStrength(cells(14))).toMatchObject({ cellCount: 14, thinData: true });
    expect(computeCityStrength(cells(15))).toMatchObject({ cellCount: 15, thinData: false });
  });

  it("edge cells with a missing or invalid affinity_rank: dropped and not counted", () => {
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

  it("edge every cell lacks a rank: unavailable", () => {
    expect(computeCityStrength([{}, { query: {} }]).status).toBe("unavailable");
  });

  it("is deterministic and order-independent", () => {
    const input = [0.91, 0.12, 0.55, 0.33].map((r) => ({ query: { affinity_rank: r } }));
    expect(computeCityStrength(input)).toEqual(computeCityStrength([...input].reverse()));
    expect(computeCityStrength(input)).toEqual(computeCityStrength(input));
  });

  it("recorded Apparat heatmaps match the values in ADR 0013", () => {
    const expected: [string, number, number, boolean][] = [
      ["london", 406, 0.599, false],
      ["berlin", 295, 0.847, false],
      ["leipzig", 39, 0.706, false],
      ["reykjavik", 23, 0.742, false],
      ["jakarta", 13, 0.276, true],
      ["mumbai", 10, 0.533, true],
      ["lagos", 1, 0.325, true],
      ["tromso", 1, 0.877, true],
    ];
    for (const [city, cellCount, mean, thinData] of expected) {
      expect(computeCityStrength(heatmapCells(`heatmap--apparat-${city}.json`))).toMatchObject({
        status: "ok",
        cellCount,
        meanAffinityRank: mean,
        thinData,
      });
    }
  });
});
