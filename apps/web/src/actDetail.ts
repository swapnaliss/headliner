import {
  detailCaveats,
  fitSpread,
  fitValuesAreClose,
  standingExplanationOf,
  type ActResult,
  type DetailCaveat,
  type Slate,
} from "@headliner/core";
import { redactEvidence, type PublicEvidence } from "@headliner/qloo";

/**
 * The act detail model (docs/design/screen-act-detail.md): everything the page and
 * `GET /api/slates/:id/acts/:actId` show, built from the stored Slate only. No Qloo call is made
 * and no number is computed here: values are copied from the ActResult and each one carries the
 * 1-based indexes of the evidence entries it rests on. A value without an index is not emitted.
 */

export type EvidenceSupport = "Fit" | "Shared tastes" | "Qloo popularity rank" | "City strength";

export interface DetailEvidence extends PublicEvidence {
  /** 1-based position in the trail; "See evidence: n" links go to `#ev-n`. */
  readonly index: number;
  readonly supports: readonly EvidenceSupport[];
}

export interface DetailNeighbour {
  readonly entityId: string;
  readonly name: string;
}

export interface ActDetail {
  readonly slateId: string;
  readonly city: string;
  readonly crowdCount: number;
  readonly act: { readonly entityId: string; readonly name: string };
  readonly status: ActResult["status"];
  readonly rank: number | null;
  readonly rankedCount: number;
  /** Set when the Fit values across the slate are within the close-values spread. */
  readonly closeSpread: number | null;
  readonly fit: { readonly value: number; readonly sharedTags: number; readonly evidenceIndexes: readonly number[] } | null;
  /** Why there is no Fit (core wording), when there is none. */
  readonly fitUnavailableReason: string | null;
  readonly whyFit: { readonly sharedTags: number; readonly topTags: readonly string[] } | null;
  readonly sharedTastes: readonly { readonly tagId: string; readonly name: string; readonly score: number; readonly covered: number | null; readonly evidenceIndexes: readonly number[] }[];
  readonly standing: {
    readonly caption: "Qloo popularity rank";
    readonly label: NonNullable<ActResult["standing"]>["label"];
    readonly candidatePercentile: number;
    readonly crowdMedianPercentile: number;
    readonly crowdSample: number;
    readonly evidenceIndexes: readonly number[];
  } | null;
  readonly standingExplanation: {
    readonly candidatePercentile: number;
    readonly crowdMedianPercentile: number;
    readonly crowdSample: number;
    readonly candidateEvidenceIndex: number;
    readonly crowdEvidenceIndexes: readonly number[];
  } | null;
  readonly caveats: readonly DetailCaveat[];
  readonly evidence: readonly DetailEvidence[];
  readonly previous: DetailNeighbour | null;
  readonly next: DetailNeighbour | null;
}

/** Entity ids in the route are untrusted: bounded text with no control characters, compared by equality only. */
export function isActId(value: string): boolean {
  return value.length > 0 && value.length <= 160 && !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value);
}

/** Route params may arrive percent-encoded; decode once, safely. */
export function decodeActId(raw: string): string {
  if (!raw.includes("%")) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** `base` is "/slates" for the owner's view and "/s" for the read-only shared view (M2-04). */
export function actDetailPath(slateId: string, entityId: string, base: "/slates" | "/s" = "/slates"): string {
  return `${base}/${slateId}/act/${encodeURIComponent(entityId)}`;
}

function sameId(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase();
}

export function buildActDetail(slate: Slate, actId: string): ActDetail | null {
  if (!isActId(actId)) return null;
  const result = slate.results.find((r) => sameId(r.act.qlooEntityId, actId));
  if (!result) return null;

  const position = new Map(result.evidence.map((e, i) => [e.id, i + 1]));
  const indexes = (refs: readonly string[]): number[] =>
    [...new Set(refs.map((ref) => position.get(ref)).filter((n): n is number => n !== undefined))].sort((a, b) => a - b);

  const supports = new Map<number, Set<EvidenceSupport>>();
  const mark = (nums: readonly number[], label: EvidenceSupport): void => {
    for (const n of nums) supports.set(n, (supports.get(n) ?? new Set()).add(label));
  };

  const fitIdx = result.fit ? indexes(result.fit.evidenceRefs) : [];
  const fit = result.fit && fitIdx.length > 0 ? { value: result.fit.value, sharedTags: result.fit.sharedTags, evidenceIndexes: fitIdx } : null;
  const sharedTastes = fit ? result.overlapTags.map((t) => ({ tagId: t.tagId, name: t.name, score: t.score, covered: t.coveredCrowdActs ?? null, evidenceIndexes: fitIdx })) : [];
  if (fit) {
    mark(fitIdx, "Fit");
    if (sharedTastes.length > 0) mark(fitIdx, "Shared tastes");
  }

  // A no-data act shows no Qloo popularity rank, as on its card: "nothing usable for this act".
  const shownStanding = result.status === "no-data" ? null : result.standing;
  const standIdx = shownStanding ? indexes(shownStanding.evidenceRefs) : [];
  const standing =
    result.standing && shownStanding && standIdx.length > 0
      ? {
          caption: result.standing.caption,
          label: result.standing.label,
          candidatePercentile: result.standing.candidatePercentile,
          crowdMedianPercentile: result.standing.crowdMedianPercentile,
          crowdSample: result.standing.crowdSample,
          evidenceIndexes: standIdx,
        }
      : null;
  if (standing) mark(standIdx, "Qloo popularity rank");
  const explained = standing ? standingExplanationOf(result) : null;
  const candidateIdx = explained ? position.get(explained.candidateEvidenceRef) : undefined;
  const crowdIdx = explained ? indexes(explained.crowdEvidenceRefs) : [];
  const standingExplanation =
    explained && candidateIdx !== undefined && crowdIdx.length > 0
      ? {
          candidatePercentile: explained.candidatePercentile,
          crowdMedianPercentile: explained.crowdMedianPercentile,
          crowdSample: explained.crowdSample,
          candidateEvidenceIndex: candidateIdx,
          crowdEvidenceIndexes: crowdIdx,
        }
      : null;
  for (const c of result.cityStrengths) mark(indexes(c.evidenceRefs), "City strength");

  const evidence: DetailEvidence[] = result.evidence.map((e, i) => ({
    ...redactEvidence(e),
    index: i + 1,
    supports: [...(supports.get(i + 1) ?? [])],
  }));

  const scored = slate.results.filter((r) => r.rank !== null && r.fit !== null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const neighbour = (r: ActResult | undefined): DetailNeighbour | null => (r ? { entityId: r.act.qlooEntityId, name: r.act.name } : null);
  const noData = result.status === "no-data" || fit === null;
  const unavailable = result.caveats.find((c) => c.type === "no-data" || c.type === "single-tag-overlap");
  const sorted = [...scored, ...slate.results.filter((r) => !scored.includes(r))];
  const sortedAt = sorted.findIndex((r) => r === result);

  return {
    slateId: slate.id,
    city: slate.room.city,
    crowdCount: slate.room.crowdActs.length,
    act: { entityId: result.act.qlooEntityId, name: result.act.name },
    status: result.status,
    rank: result.rank,
    rankedCount: scored.length,
    closeSpread: fitValuesAreClose(scored) ? fitSpread(scored) : null,
    fit,
    fitUnavailableReason: noData ? (unavailable?.message ?? "Qloo returned nothing usable for this act, so no Fit or Qloo popularity rank is shown.") : null,
    whyFit: fit ? { sharedTags: result.overlapTags.length || fit.sharedTags, topTags: [...result.overlapTags].sort((a, b) => b.score - a.score).slice(0, 3).map((t) => t.name) } : null,
    sharedTastes,
    standing,
    standingExplanation,
    caveats: detailCaveats({ caveats: result.caveats, standing }),
    evidence,
    previous: neighbour(sorted[sortedAt - 1]),
    next: neighbour(sorted[sortedAt + 1]),
  };
}
