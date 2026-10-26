import { compareStrings } from "./num";
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
