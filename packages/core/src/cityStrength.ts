import { computeCityStrength, THIN_DATA_CELLS, type HeatmapCell } from "./city";
import { compareStrings, isUnitInterval, roundTo } from "./num";

/**
 * City strength summary for one act in one city (ADR 0013, ticket M2-03).
 * Qloo rescales raw heatmap values inside each city, so the only quantities comparable across
 * cities are the mean of `affinity_rank` and the number of cells behind it. Nothing here reads
 * or compares the raw per-cell values.
 */
export interface CityStrengthSummary {
  /** Mean `affinity_rank` (0..1, three decimals), or null when no usable cell exists. */
  readonly meanAffinityRank: number | null;
  /** Cells with a usable `affinity_rank`. */
  readonly cellCount: number;
  /** True when fewer than THIN_DATA_CELLS cells back the mean (including none). */
  readonly thin: boolean;
}

const NO_CELLS: CityStrengthSummary = { meanAffinityRank: null, cellCount: 0, thin: true };

/** Summary from raw heatmap cells. Cells without a usable `affinity_rank` are ignored. */
export function cityStrength(cells: readonly HeatmapCell[] | null | undefined): CityStrengthSummary {
  const result = computeCityStrength(cells);
  if (result.status === "unavailable") return NO_CELLS;
  return { meanAffinityRank: result.meanAffinityRank, cellCount: result.cellCount, thin: result.thinData };
}

/** Summary from the adapter's aggregate (the raw grid never leaves the adapter, ADR 0002). */
export function cityStrengthFromAggregate(aggregate: {
  readonly cellCount: number;
  readonly meanAffinityRank: number | null;
}): CityStrengthSummary {
  const { cellCount, meanAffinityRank } = aggregate;
  if (!Number.isInteger(cellCount) || cellCount < 1 || !isUnitInterval(meanAffinityRank)) return NO_CELLS;
  return { meanAffinityRank: roundTo(meanAffinityRank, 3), cellCount, thin: cellCount < THIN_DATA_CELLS };
}

/** The part of a city row that ordering reads. */
export interface RankableCity {
  readonly city: string;
  readonly meanAffinityRank: number;
  readonly cellCount: number;
  readonly thin: boolean;
}

/**
 * Orders cities for display: enough-data cities by mean `affinity_rank` (highest first), then
 * thin-data cities in their own group, never mixed in, even when a one-cell city has a high mean.
 * Ties break by more cells, then by name, so the order is identical on every run.
 */
export function rankCities<T extends RankableCity>(rows: readonly T[]): { readonly ranked: T[]; readonly thin: T[] } {
  const byStrength = (a: T, b: T): number =>
    b.meanAffinityRank - a.meanAffinityRank || b.cellCount - a.cellCount || compareStrings(a.city, b.city);
  return {
    ranked: rows.filter((r) => !r.thin).sort(byStrength),
    thin: rows.filter((r) => r.thin).sort(byStrength),
  };
}
