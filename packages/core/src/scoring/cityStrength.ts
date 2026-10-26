import { isUnitInterval, roundTo, unavailable, type Unavailable } from "./types";

/** Fewer heatmap cells than this is a thin-data city (ADR 0013). */
export const THIN_DATA_CELLS = 15;

/** The part of a `/v2/insights` heatmap cell that city strength reads. */
export interface HeatmapCell {
  readonly query?: { readonly affinity_rank?: number | null };
}

export interface CityStrengthOk {
  readonly status: "ok";
  /** Mean `affinity_rank` (0..1) over usable cells, three decimals. */
  readonly meanAffinityRank: number;
  /** Cells with a usable affinity_rank. */
  readonly cellCount: number;
  /** Cells ignored because affinity_rank was missing, non-finite or outside 0..1. */
  readonly droppedCells: number;
  /** True when cellCount < THIN_DATA_CELLS: show the thin-data caveat. */
  readonly thinData: boolean;
}

export type CityStrengthResult = CityStrengthOk | Unavailable;

/**
 * City strength for one act in one city. Heatmap `affinity` and `popularity` are rescaled per
 * city, so only the mean affinity_rank and the cell count are comparable across cities.
 */
export function computeCityStrength(cells: readonly HeatmapCell[] | null | undefined): CityStrengthResult {
  if (!Array.isArray(cells) || cells.length === 0) return unavailable("zero-cells");
  const ranks: number[] = [];
  for (const cell of cells) {
    const rank = cell?.query?.affinity_rank;
    if (isUnitInterval(rank)) ranks.push(rank);
  }
  if (ranks.length === 0) return unavailable("zero-cells");
  ranks.sort((a, b) => a - b); // order-independent float sum
  const mean = ranks.reduce((sum, r) => sum + r, 0) / ranks.length;
  return {
    status: "ok",
    meanAffinityRank: roundTo(mean, 3),
    cellCount: ranks.length,
    droppedCells: cells.length - ranks.length,
    thinData: ranks.length < THIN_DATA_CELLS,
  };
}
