import { compareStrings, isUnitInterval, roundTo, unavailable, type Unavailable } from "./types";

/** Minimum number of distinct shared tags before a Fit number is shown (ADR 0013). */
export const FIT_MIN_SHARED_TAGS = 3;

/** The part of a `/v2/insights/compare` `results.tags[]` item that Fit reads (ADR 0013). */
export interface CompareTag {
  readonly tag_id: string;
  readonly query: {
    readonly score: number;
    readonly "a.signal.interests.entities"?: readonly { readonly entity_id: string }[];
  };
}

export interface FitOk {
  readonly status: "ok";
  /** Audience-taste fit, 0..100, one decimal. Not a forecast. */
  readonly fit: number;
  /** Distinct tag ids that contributed. */
  readonly sharedTags: number;
  /** Tag entries ignored because tag_id or score was unusable. */
  readonly droppedTags: number;
}

export type FitResult = FitOk | Unavailable;

function crowdCoverage(tag: CompareTag): number {
  const entities = tag.query["a.signal.interests.entities"];
  if (!Array.isArray(entities)) return 0;
  return new Set(entities.map((e: { entity_id: string }) => e.entity_id)).size;
}

/**
 * Fit between a crowd set and one candidate from the compare result.
 *
 * Qloo repeats a tag once per subset of the crowd it matched (and once for the artist and
 * the person entity of the same id). For each distinct `tag_id` the repeat covering the most
 * distinct crowd acts is used (ties: the higher score). Fit is 100 x the mean of those scores,
 * rounded to one decimal. Entries with a blank tag_id or a non-finite or out-of-0..1 score are
 * dropped and counted. Fewer than FIT_MIN_SHARED_TAGS distinct tags gives "unavailable".
 */
export function computeFit(tags: readonly CompareTag[] | null | undefined): FitResult {
  if (!Array.isArray(tags) || tags.length === 0) return unavailable("no-shared-tags");
  const best = new Map<string, { coverage: number; score: number }>();
  let droppedTags = 0;
  for (const tag of tags) {
    const score = tag?.query?.score;
    if (typeof tag?.tag_id !== "string" || tag.tag_id === "" || !isUnitInterval(score)) {
      droppedTags += 1;
      continue;
    }
    const coverage = crowdCoverage(tag);
    const current = best.get(tag.tag_id);
    if (!current || coverage > current.coverage || (coverage === current.coverage && score > current.score)) {
      best.set(tag.tag_id, { coverage, score });
    }
  }
  if (best.size < FIT_MIN_SHARED_TAGS) {
    return unavailable(best.size === 0 ? "no-shared-tags" : "too-few-shared-tags");
  }
  // Sum in tag_id order so the float result does not depend on the response's ordering.
  const scores = [...best.entries()].sort((x, y) => compareStrings(x[0], y[0])).map(([, v]) => v.score);
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return { status: "ok", fit: roundTo(mean * 100, 1), sharedTags: scores.length, droppedTags };
}

export interface CandidateFitInput {
  /** null when the entity match was not resolved. */
  readonly candidateId: string | null;
  readonly crowdIds: readonly string[];
  /** null when no compare result exists for this candidate. */
  readonly tags: readonly CompareTag[] | null;
}

/** Fit for one candidate, covering the unresolved-entity and candidate-in-crowd cases. */
export function fitForCandidate(input: CandidateFitInput): FitResult {
  if (input.candidateId === null || input.candidateId === "" || input.tags === null) {
    return unavailable("unresolved-entity");
  }
  const id = input.candidateId.toUpperCase();
  if (input.crowdIds.some((c) => c.toUpperCase() === id)) return unavailable("candidate-in-crowd");
  return computeFit(input.tags);
}

export interface RankInput {
  readonly entityId: string;
  readonly name: string;
  readonly fit: FitResult;
}

export interface Ranked extends RankInput {
  /** 1-based position. Ties are broken, never shared. */
  readonly rank: number;
}

/**
 * Rank candidates: Fit descending, then name, then entity id (code-unit order). Unavailable
 * candidates follow every scored one, in the same name/id order. A repeated entity id (case
 * insensitive) is kept once, at its first appearance.
 */
export function rankByFit(items: readonly RankInput[]): readonly Ranked[] {
  const seen = new Set<string>();
  const unique: RankInput[] = [];
  for (const item of items) {
    const key = item.entityId.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  const score = (r: RankInput): number => (r.fit.status === "ok" ? r.fit.fit : -1);
  unique.sort(
    (a, b) => score(b) - score(a) || compareStrings(a.name, b.name) || compareStrings(a.entityId, b.entityId),
  );
  return unique.map((item, index) => ({ ...item, rank: index + 1 }));
}
