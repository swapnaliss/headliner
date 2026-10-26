import { compareStrings, roundTo } from "./num";
import type { ActResult } from "./types";

/**
 * Order act results for the slate (ADR 0013 section 4): Fit descending, then Qloo popularity
 * percentile descending (standing), then name, then entity id (code-unit order, so the result is
 * the same in every locale). Acts without a Fit are `no-data`: they follow every scored act, in
 * the same standing/name/id order, with rank null and status "no-data". A repeated entity id
 * (case-insensitive) is kept once, at its first appearance. The input is not modified.
 */
export function rankActs(results: readonly ActResult[]): ActResult[] {
  const seen = new Set<string>();
  const unique: ActResult[] = [];
  for (const result of results) {
    const key = result.act.qlooEntityId.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(result);
  }
  const standing = (r: ActResult): number => (r.standing ? r.standing.candidatePercentile : -1);
  const compare = (a: ActResult, b: ActResult): number =>
    standing(b) - standing(a) ||
    compareStrings(a.act.name, b.act.name) ||
    compareStrings(a.act.qlooEntityId, b.act.qlooEntityId);
  const scored = unique.filter((r) => r.fit !== null).sort((a, b) => (b.fit?.value ?? 0) - (a.fit?.value ?? 0) || compare(a, b));
  const noData = unique.filter((r) => r.fit === null).sort(compare);
  return [
    ...scored.map((r, index): ActResult => ({ ...r, status: "scored", rank: index + 1 })),
    ...noData.map((r): ActResult => ({ ...r, status: "no-data", rank: null })),
  ];
}

/** Fit values closer than this (best minus worst scored act, in Fit points) are called close on the slate (ADR 0013 section 4). */
export const FIT_CLOSE_SPREAD_POINTS = 5;

/** Best minus worst Fit among scored acts, one decimal; null when fewer than two acts have a Fit. */
export function fitSpread(results: readonly ActResult[]): number | null {
  const values = results.flatMap((r) => (r.fit ? [r.fit.value] : []));
  if (values.length < 2) return null;
  return roundTo(Math.max(...values) - Math.min(...values), 1);
}

/** True when the spread is known and below `FIT_CLOSE_SPREAD_POINTS`. */
export function fitValuesAreClose(results: readonly ActResult[]): boolean {
  const spread = fitSpread(results);
  return spread !== null && spread < FIT_CLOSE_SPREAD_POINTS;
}

/**
 * 1-based position of each act by Qloo popularity percentile, highest first (ties: name, then entity id).
 * Acts without a standing value are absent from the map. Used for the Fit position versus popularity position comparison.
 */
export function popularityPositions(results: readonly ActResult[]): Map<string, number> {
  const withStanding = results.filter((r) => r.standing !== null);
  withStanding.sort(
    (a, b) =>
      (b.standing?.candidatePercentile ?? 0) - (a.standing?.candidatePercentile ?? 0) ||
      compareStrings(a.act.name, b.act.name) ||
      compareStrings(a.act.qlooEntityId, b.act.qlooEntityId),
  );
  return new Map(withStanding.map((r, i) => [r.act.qlooEntityId, i + 1]));
}
