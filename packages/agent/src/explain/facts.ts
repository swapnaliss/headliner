import { fitSpread, fitValuesAreClose, type ActResult, type Slate } from "@headliner/core";

/**
 * Labelled facts flattened from a Slate (ticket M3-02). Every number is a string already rounded
 * the way the UI shows it, so a sentence built from a fact repeats exactly what the page shows and
 * `groundingCheck` can compare strings. Names are untrusted third-party text: they travel as data
 * fields only and are never part of an instruction.
 */

/** Rounding used by the UI: Fit and percentiles 1 dp, tag scores 2 dp, city mean affinity rank 3 dp, counts whole. */
export const fmt = {
  count: (n: number): string => String(Math.round(n)),
  one: (n: number): string => n.toFixed(1),
  two: (n: number): string => n.toFixed(2),
  three: (n: number): string => n.toFixed(3),
} as const;

export interface RoomFact {
  readonly kind: "room";
  readonly city: string;
  /** Regular-crowd acts compared. */
  readonly crowdActs: string;
  /** Candidate acts in the slate. */
  readonly candidates: string;
  /** Candidates with an audience-taste fit. */
  readonly scored: string;
  /** Candidates that could not be scored. */
  readonly unscored: string;
  /** Present only when the Fit values are close together: best minus worst, in points. */
  readonly closeSpread?: string;
}

export interface FitFact {
  readonly kind: "fit";
  readonly act: string;
  readonly rank: string;
  readonly fit: string;
  readonly sharedTags: string;
}

export interface TastesFact {
  readonly kind: "tastes";
  readonly act: string;
  readonly tags: readonly { readonly name: string; readonly score: string }[];
}

export interface StandingFact {
  readonly kind: "standing";
  readonly act: string;
  /** Always "Qloo popularity rank": it is a standing on Qloo, never a trend. */
  readonly caption: "Qloo popularity rank";
  readonly candidate: string;
  readonly crowdMedian: string;
  readonly crowdSample: string;
  readonly label: "above" | "similar" | "below";
}

export interface CityFact {
  readonly kind: "city";
  readonly act: string;
  readonly city: string;
  readonly meanAffinityRank: string;
  readonly cells: string;
  readonly thinData: boolean;
}

export interface CaveatFact {
  readonly kind: "caveat";
  readonly act: string;
  /** Fixed wording from core. */
  readonly message: string;
  readonly subject?: string;
}

export interface NoDataFact {
  readonly kind: "no-data";
  readonly act: string;
  /** Fixed core wording saying why there is no Fit. */
  readonly reason: string;
}

export type Fact = RoomFact | FitFact | TastesFact | StandingFact | CityFact | CaveatFact | NoDataFact;

const MAX_TASTES = 3;

function scoredOf(result: ActResult): boolean {
  return result.rank !== null && result.fit !== null;
}

/** Facts for one act: fit, shared tastes, Qloo popularity rank, city strengths and caveats. A `no-data` act yields its reason and caveats only. */
export function buildFacts(result: ActResult): Fact[] {
  const act = result.act.name;
  const facts: Fact[] = [];
  if (result.fit && result.rank !== null) {
    facts.push({ kind: "fit", act, rank: fmt.count(result.rank), fit: fmt.one(result.fit.value), sharedTags: fmt.count(result.fit.sharedTags) });
    const top = [...result.overlapTags]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, MAX_TASTES)
      .map((t) => ({ name: t.name, score: fmt.two(t.score) }));
    if (top.length > 0) facts.push({ kind: "tastes", act, tags: top });
  } else {
    const reason = result.caveats.find((c) => c.type === "no-data")?.message ?? "Qloo returned too little data to score this act.";
    facts.push({ kind: "no-data", act, reason });
  }
  if (result.standing) {
    facts.push({
      kind: "standing",
      act,
      caption: "Qloo popularity rank",
      candidate: fmt.one(result.standing.candidatePercentile),
      crowdMedian: fmt.one(result.standing.crowdMedianPercentile),
      crowdSample: fmt.count(result.standing.crowdSample),
      label: result.standing.label,
    });
  }
  for (const c of [...result.cityStrengths].sort((a, b) => a.city.localeCompare(b.city))) {
    facts.push({ kind: "city", act, city: c.city, meanAffinityRank: fmt.three(c.meanAffinityRank), cells: fmt.count(c.cellCount), thinData: c.thinData });
  }
  for (const c of result.caveats) {
    // The no-data reason is already a fact of its own.
    if (c.type === "no-data" && !result.fit && c.subject === undefined) continue;
    facts.push(c.subject !== undefined ? { kind: "caveat", act, message: c.message, subject: c.subject } : { kind: "caveat", act, message: c.message });
  }
  return facts;
}

export interface FactScope {
  /** Explain this one act (by Qloo entity id). Otherwise the slate summary covers the top acts. */
  readonly actId?: string | undefined;
}

/** Acts covered by the slate-level summary. */
export const SLATE_SUMMARY_ACTS = 3;

/** The room fact and then the facts of the acts in scope (the top acts for a slate summary, one act for a detail page). */
export function buildSlateFacts(slate: Slate, scope: FactScope = {}): Fact[] {
  const ranked = slate.results.filter(scoredOf).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const close = fitValuesAreClose(ranked);
  const spread = fitSpread(ranked);
  const room: RoomFact = {
    kind: "room",
    city: slate.room.city,
    crowdActs: fmt.count(slate.room.crowdActs.length),
    candidates: fmt.count(slate.results.length),
    scored: fmt.count(ranked.length),
    unscored: fmt.count(slate.results.length - ranked.length),
    ...(close && spread !== null ? { closeSpread: fmt.one(spread) } : {}),
  };
  if (scope.actId !== undefined) {
    const one = slate.results.find((r) => r.act.qlooEntityId === scope.actId);
    return one ? [room, ...buildFacts(one)] : [room];
  }
  return [room, ...ranked.slice(0, SLATE_SUMMARY_ACTS).flatMap(buildFacts)];
}
