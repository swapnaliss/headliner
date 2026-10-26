import { fitSpread, fitValuesAreClose, popularityPositions, type ActResult, type Slate } from "@headliner/core";

export interface SlateViewModel {
  ranked: ActResult[];
  unranked: ActResult[];
  /** Best minus worst Fit among scored acts, when known. */
  spread: number | null;
  close: boolean;
  /** Acts (by entity id) whose displayed Fit equals the act above, so the tied note shows. */
  tied: Set<string>;
  comparison: ComparisonRow[];
  /** Acts whose Fit position differs from their popularity position. */
  differing: number;
}

export interface ComparisonRow {
  id: string;
  name: string;
  fitPosition: number;
  popularityPosition: number;
}

/** Splits a slate for display. Every number comes from core; positions here are derived orderings, not new measurements. */
export function buildSlateView(slate: Slate): SlateViewModel {
  const ranked = slate.results.filter((r) => r.rank !== null && r.fit !== null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const unranked = slate.results.filter((r) => !(r.rank !== null && r.fit !== null));
  const tied = new Set<string>();
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1];
    if (prev?.fit && r.fit && prev.fit.value.toFixed(1) === r.fit.value.toFixed(1)) tied.add(r.act.qlooEntityId);
  });
  // Compare only acts that have both a Fit rank and a standing, so the two positions are over the same set.
  const both = ranked.filter((r) => r.standing !== null);
  const popularity = popularityPositions(both);
  const comparison: ComparisonRow[] = both.map((r, index) => ({
    id: r.act.qlooEntityId,
    name: r.act.name,
    fitPosition: index + 1,
    popularityPosition: popularity.get(r.act.qlooEntityId) ?? index + 1,
  }));
  return {
    ranked,
    unranked,
    spread: fitSpread(ranked),
    close: fitValuesAreClose(ranked),
    tied,
    comparison,
    differing: comparison.filter((c) => c.fitPosition !== c.popularityPosition).length,
  };
}
