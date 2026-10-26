import { compareStrings, isUnitInterval, roundTo } from "./num";

/** Minimum number of distinct shared tags before a Fit number is shown (ADR 0013). */
export const FIT_MIN_SHARED_TAGS = 3;

/** The part of a `/v2/insights/compare` `results.tags[]` item that Fit reads (ADR 0013). */
export interface CompareTag {
  readonly tag_id: string;
  readonly name?: string;
  readonly query: {
    readonly score: number;
    readonly "a.signal.interests.entities"?: readonly { readonly entity_id: string }[];
  };
}

/** One shared tag that contributed to Fit, as shown in the evidence trail. */
export interface OverlapTag {
  readonly tagId: string;
  readonly name: string;
  /** Qloo `query.score` (0..1) of the chosen repeat. */
  readonly score: number;
}

export interface FitOk {
  readonly status: "ok";
  /** Audience-taste fit, 0..100, one decimal. Aggregate affinity only. */
  readonly fit: number;
  /** Distinct tag ids that contributed. */
  readonly sharedTags: number;
  /** Tag entries ignored because tag_id or score was unusable. */
  readonly droppedTags: number;
  /** The contributing tags, strongest first (ties by tag id). */
  readonly overlapTags: readonly OverlapTag[];
  /** Evidence ids supplied by the caller for the compare call behind this number. */
  readonly evidenceRefs: readonly string[];
}

export type FitUnavailableReason =
  | "no-shared-tags"
  | "too-few-shared-tags"
  | "unresolved-entity"
  | "candidate-in-crowd";

export interface FitUnavailable {
  readonly status: "unavailable";
  readonly reason: FitUnavailableReason;
  /** Distinct usable tags found; set for `too-few-shared-tags` so a caveat can say how few. */
  readonly sharedTags?: number;
}

export type FitResult = FitOk | FitUnavailable;

function unavailableFit(reason: FitUnavailableReason, sharedTags?: number): FitUnavailable {
  return sharedTags === undefined ? { status: "unavailable", reason } : { status: "unavailable", reason, sharedTags };
}

function crowdCoverage(tag: CompareTag): number {
  const entities = tag.query["a.signal.interests.entities"];
  if (!Array.isArray(entities)) return 0;
  return new Set(entities.map((e: { entity_id: string }) => e.entity_id)).size;
}

interface Chosen {
  coverage: number;
  score: number;
  name: string;
}

/**
 * Fit between a crowd set and one candidate from the compare result's `results.tags[]`.
 *
 * Qloo repeats a tag once per subset of the crowd it matched (and once for the artist and
 * the person entity of the same id). For each distinct `tag_id` the repeat covering the most
 * distinct crowd acts is used (ties: the higher score). Fit is 100 x the mean of those scores,
 * rounded to one decimal. Entries with a blank tag_id or a non-finite or out-of-0..1 score are
 * dropped and counted. Fewer than FIT_MIN_SHARED_TAGS distinct tags gives "unavailable".
 * The result does not depend on the order of `tags`.
 */
export function computeFit(
  tags: readonly CompareTag[] | null | undefined,
  evidenceRefs: readonly string[] = [],
): FitResult {
  if (!Array.isArray(tags) || tags.length === 0) return unavailableFit("no-shared-tags");
  const best = new Map<string, Chosen>();
  let droppedTags = 0;
  for (const tag of tags) {
    const score = tag?.query?.score;
    if (typeof tag?.tag_id !== "string" || tag.tag_id === "" || !isUnitInterval(score)) {
      droppedTags += 1;
      continue;
    }
    const coverage = crowdCoverage(tag);
    const name = typeof tag.name === "string" && tag.name !== "" ? tag.name : tag.tag_id;
    const current = best.get(tag.tag_id);
    if (
      !current ||
      coverage > current.coverage ||
      (coverage === current.coverage && (score > current.score || (score === current.score && name < current.name)))
    ) {
      best.set(tag.tag_id, { coverage, score, name });
    }
  }
  if (best.size < FIT_MIN_SHARED_TAGS) {
    return best.size === 0 ? unavailableFit("no-shared-tags") : unavailableFit("too-few-shared-tags", best.size);
  }
  // Sum in tag_id order so the float result does not depend on the response's ordering.
  const ordered = [...best.entries()].sort((x, y) => compareStrings(x[0], y[0]));
  const mean = ordered.reduce((sum, [, v]) => sum + v.score, 0) / ordered.length;
  const overlapTags = ordered
    .map(([tagId, v]) => ({ tagId, name: v.name, score: v.score }))
    .sort((x, y) => y.score - x.score || compareStrings(x.tagId, y.tagId));
  return {
    status: "ok",
    fit: roundTo(mean * 100, 1),
    sharedTags: ordered.length,
    droppedTags,
    overlapTags,
    evidenceRefs: [...evidenceRefs],
  };
}

export interface CandidateFitInput {
  /** null when the entity match was not resolved. */
  readonly candidateId: string | null;
  readonly crowdIds: readonly string[];
  /** null when no compare result exists for this candidate. */
  readonly tags: readonly CompareTag[] | null;
  readonly evidenceRefs?: readonly string[];
}

/** Fit for one candidate, covering the unresolved-entity and candidate-in-crowd cases. */
export function fitForCandidate(input: CandidateFitInput): FitResult {
  if (input.candidateId === null || input.candidateId === "" || input.tags === null) {
    return unavailableFit("unresolved-entity");
  }
  const id = input.candidateId.toUpperCase();
  if (input.crowdIds.some((c) => c.toUpperCase() === id)) return unavailableFit("candidate-in-crowd");
  return computeFit(input.tags, input.evidenceRefs ?? []);
}
