import { createHash } from "node:crypto";
import {
  assertEveryNumberHasEvidence,
  buildCaveats,
  computeStanding,
  fitForCandidate,
  rankActs,
  type Act,
  type ActResult,
  type Caveat,
  type CreateSlateRequest,
  type Evidence,
  type FitResult,
  type Slate,
} from "@headliner/core";
import { QlooError, QlooRateLimited, type Evidence as QlooEvidence, type QlooResult, type SearchEntity } from "@headliner/qloo";
import type { Runtime } from "../config";
import { ApiError } from "../errors";
import { newSlateId } from "../slateStore";

/**
 * Create-slate pipeline (ADR 0004): resolve -> compare -> score -> rank inside one request. The
 * adapter caps concurrency at 6, so launching every call at once never fans out beyond that cap.
 * Scores come from `@headliner/core`; nothing here computes a number.
 */

/** Wall-clock budget for the whole run. Compares not started by then become `no-data`. */
export const DEFAULT_BUDGET_MS = 45_000;
const MAX_OPTIONS = 5;
/** Confidence of a name that matches exactly but is not Qloo's first hit. */
const CONFIDENCE_EXACT_NOT_TOP = 0.9;

const UNAVAILABLE_CAVEAT: Caveat = {
  type: "no-data",
  message: "No Qloo data is available for this act right now, so no audience-taste fit is shown.",
};
const BUDGET_CAVEAT: Caveat = {
  type: "no-data",
  message: "This act was not scored within the time limit for one run, so no audience-taste fit is shown.",
};

export interface MatchOption {
  readonly entityId: string;
  readonly name: string;
  readonly disambiguation: string | null;
  readonly popularity: number;
}

/** A name that Qloo could not resolve to one entity with confidence. Strings are untrusted: render as plain text. */
export interface AmbiguousMatch {
  readonly role: "crowd" | "candidate";
  readonly input: string;
  readonly options: readonly MatchOption[];
}

export type CreateSlateOutcome =
  | {
      readonly status: "done";
      readonly id: string;
      readonly slate: Slate;
      /** Crowd acts that could not be matched and were left out of the crowd. */
      readonly unresolvedCrowdActs: readonly string[];
      /** True when any Qloo result came from an expired cache entry (ADR 0007). */
      readonly stale: boolean;
    }
  | {
      readonly status: "awaiting_confirmation";
      readonly ambiguous: readonly AmbiguousMatch[];
    };

export interface CreateSlateOptions {
  readonly budgetMs?: number;
  readonly clock?: () => number;
}

/** Lower-case, accent-free, punctuation-free form used to compare names. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

type Resolution =
  | { readonly kind: "resolved"; readonly input: string; readonly entity: SearchEntity; readonly confidence: number; readonly evidence: Evidence }
  | { readonly kind: "ambiguous"; readonly input: string; readonly options: readonly SearchEntity[] }
  | { readonly kind: "none"; readonly input: string }
  | { readonly kind: "failed"; readonly input: string; readonly rateLimited: boolean };

export function toEvidence(q: QlooEvidence): Evidence {
  const sorted = Object.entries(q.redactedParams).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const id = `ev-${createHash("sha256").update(`${q.endpoint}?${JSON.stringify(sorted)}`).digest("hex").slice(0, 12)}`;
  return { id, endpoint: q.endpoint, redactedParams: { ...q.redactedParams }, responseDigest: q.responseDigest, fetchedAt: q.fetchedAt };
}

function dedupeEvidence(items: readonly Evidence[]): Evidence[] {
  const seen = new Set<string>();
  return items.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

/** Decide whether a name resolved: provisional rules, M2-01 owns the final confirmation model. */
function assess(input: string, results: readonly SearchEntity[]): { entity: SearchEntity; confidence: number } | "none" | "ambiguous" {
  if (results.length === 0) return "none";
  const wanted = normalizeName(input);
  const exact = results.filter((r) => normalizeName(r.name) === wanted);
  const distinct = new Set(exact.map((r) => r.entityId.toUpperCase()));
  if (exact.length === 0 || distinct.size > 1) return "ambiguous";
  const entity = exact[0] as SearchEntity;
  return { entity, confidence: entity === results[0] ? 1 : CONFIDENCE_EXACT_NOT_TOP };
}

async function resolve(rt: Runtime, input: string, stale: { value: boolean }): Promise<Resolution> {
  let found: QlooResult<SearchEntity[]>;
  try {
    found = await rt.client.search(input);
  } catch (e) {
    return { kind: "failed", input, rateLimited: e instanceof QlooRateLimited };
  }
  if (found.stale) stale.value = true;
  const verdict = assess(input, found.data);
  if (verdict === "none") return { kind: "none", input };
  if (verdict === "ambiguous") return { kind: "ambiguous", input, options: found.data.slice(0, MAX_OPTIONS) };
  return { kind: "resolved", input, entity: verdict.entity, confidence: verdict.confidence, evidence: toEvidence(found.evidence) };
}

function firstByKey<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

type Compare = { readonly kind: "ok"; readonly tags: Awaited<ReturnType<Runtime["client"]["compareAudiences"]>>["data"]; readonly evidence: Evidence } | { readonly kind: "failed" } | { readonly kind: "skipped" };

export async function createSlate(request: CreateSlateRequest, rt: Runtime, options: CreateSlateOptions = {}): Promise<CreateSlateOutcome> {
  const clock = options.clock ?? Date.now;
  const deadline = clock() + (options.budgetMs ?? DEFAULT_BUDGET_MS);
  const stale = { value: false };

  // A name repeated in the request is one act (compared case- and accent-insensitively).
  const crowdNames = firstByKey(request.crowdActs, normalizeName);
  const candidateNames = firstByKey(request.candidateActs, normalizeName);

  const [crowdRes, candRes] = await Promise.all([
    Promise.all(crowdNames.map((n) => resolve(rt, n, stale))),
    Promise.all(candidateNames.map((n) => resolve(rt, n, stale))),
  ]);

  const ambiguous: AmbiguousMatch[] = [
    ...crowdRes.flatMap((r) => (r.kind === "ambiguous" ? [{ role: "crowd" as const, input: r.input, options: toOptions(r.options) }] : [])),
    ...candRes.flatMap((r) => (r.kind === "ambiguous" ? [{ role: "candidate" as const, input: r.input, options: toOptions(r.options) }] : [])),
  ];
  if (ambiguous.length > 0) return { status: "awaiting_confirmation", ambiguous };

  const crowd = firstByKey(
    crowdRes.flatMap((r) => (r.kind === "resolved" ? [r] : [])),
    (r) => r.entity.entityId.toUpperCase(),
  );
  const unresolvedCrowdActs = crowdRes.filter((r) => r.kind === "none" || r.kind === "failed").map((r) => r.input);
  if (crowd.length === 0) {
    // Live mode: an upstream failure is not "no data", the caller should retry. Fixtures mode has
    // no upstream: an unrecorded name is honestly "no data".
    const failures = crowdRes.filter((r) => r.kind === "failed");
    if (rt.mode === "live" && failures.length > 0) {
      throw new ApiError(failures.some((f) => f.kind === "failed" && f.rateLimited) ? "rate_limited" : "upstream_unavailable");
    }
  }

  const crowdIds = crowd.map((r) => r.entity.entityId);
  const crowdEvidence = crowd.map((r) => r.evidence);
  const crowdPopularity = crowd.map((r) => r.entity.popularity);
  const crowdActs: Act[] = crowd.map((r) => ({ qlooEntityId: r.entity.entityId, name: r.entity.name, matchConfidence: r.confidence }));

  // One compare per distinct matched candidate (a list compare merges several candidates).
  const matched = firstByKey(
    candRes.flatMap((r) => (r.kind === "resolved" ? [r] : [])),
    (r) => r.entity.entityId.toUpperCase(),
  );
  const compares = new Map<string, Compare>();
  await Promise.all(
    matched.map(async (r): Promise<void> => {
      const id = r.entity.entityId.toUpperCase();
      const inCrowd = crowdIds.some((c) => c.toUpperCase() === id);
      if (inCrowd || crowd.length === 0 || clock() > deadline) {
        compares.set(id, { kind: "skipped" });
        return;
      }
      try {
        const res = await rt.client.compareAudiences(crowdIds, [r.entity.entityId]);
        if (res.stale) stale.value = true;
        compares.set(id, { kind: "ok", tags: res.data, evidence: toEvidence(res.evidence) });
      } catch (e) {
        if (!(e instanceof QlooError)) throw e;
        compares.set(id, { kind: "failed" });
      }
    }),
  );

  const results: ActResult[] = [];
  const seenUnmatched = new Set<string>();
  for (const r of candRes) {
    if (r.kind === "resolved") {
      const id = r.entity.entityId.toUpperCase();
      if (results.some((x) => x.act.qlooEntityId.toUpperCase() === id)) continue;
      results.push(scoreMatched(r, compares.get(id) ?? { kind: "skipped" }, crowdIds, crowdEvidence, crowdPopularity, clock() > deadline));
    } else if (r.kind === "none" || r.kind === "failed") {
      const key = `unmatched:${normalizeName(r.input)}`;
      if (seenUnmatched.has(key)) continue;
      seenUnmatched.add(key);
      results.push(unmatchedResult(r, key));
    }
  }

  const ranked = rankActs(results);
  for (const result of ranked) assertEveryNumberHasEvidence(result);

  const id = newSlateId();
  const slate: Slate = { id, room: { city: request.city, crowdActs }, results: ranked, createdAt: rt.now().toISOString() };
  try {
    await rt.store.save(slate);
  } catch {
    throw new ApiError("internal_error");
  }
  return { status: "done", id, slate, unresolvedCrowdActs, stale: stale.value };
}

function toOptions(entities: readonly SearchEntity[]): MatchOption[] {
  return entities.map((e) => ({ entityId: e.entityId, name: e.name, disambiguation: e.disambiguation, popularity: e.popularity }));
}

function scoreMatched(
  r: Extract<Resolution, { kind: "resolved" }>,
  compare: Compare,
  crowdIds: readonly string[],
  crowdEvidence: readonly Evidence[],
  crowdPopularity: readonly number[],
  overBudget: boolean,
): ActResult {
  const inCrowd = crowdIds.some((c) => c.toUpperCase() === r.entity.entityId.toUpperCase());
  const compareEvidence = compare.kind === "ok" ? compare.evidence : undefined;
  const fit: FitResult = fitForCandidate({
    candidateId: r.entity.entityId,
    crowdIds,
    // An in-crowd act needs no compare; any other act without compare data is unresolved.
    tags: compare.kind === "ok" ? compare.tags : inCrowd ? [] : null,
    evidenceRefs: compareEvidence ? [compareEvidence.id] : [],
  });
  const standing = computeStanding(r.entity.popularity, crowdPopularity);
  const standingEvidence = [r.evidence, ...crowdEvidence];

  const caveats = buildCaveats({ fit, standing, matchConfidence: r.confidence });
  if (fit.status === "unavailable" && fit.reason === "unresolved-entity") {
    // The act matched; the failure was upstream (or the time budget). Say so instead of "not matched".
    const at = caveats.findIndex((c) => c.type === "no-data");
    caveats.splice(at, 1, compare.kind === "skipped" && overBudget ? BUDGET_CAVEAT : UNAVAILABLE_CAVEAT);
  }

  const evidence = dedupeEvidence([
    r.evidence,
    ...(compareEvidence && fit.status === "ok" ? [compareEvidence] : []),
    ...(standing.status === "ok" ? crowdEvidence : []),
  ]);
  return {
    act: { qlooEntityId: r.entity.entityId, name: r.entity.name, matchConfidence: r.confidence },
    status: fit.status === "ok" ? "scored" : "no-data",
    rank: null,
    fit: fit.status === "ok" ? { value: fit.fit, sharedTags: fit.sharedTags, evidenceRefs: [...fit.evidenceRefs] } : null,
    overlapTags: fit.status === "ok" ? fit.overlapTags.map((t) => ({ ...t })) : [],
    standing:
      standing.status === "ok"
        ? {
            caption: standing.caption,
            candidatePercentile: standing.candidatePercentile,
            crowdMedianPercentile: standing.crowdMedianPercentile,
            crowdSample: standing.crowdSample,
            deltaPoints: standing.deltaPoints,
            label: standing.label,
            evidenceRefs: standingEvidence.map((e) => e.id),
          }
        : null,
    standingExplanation:
      standing.status === "ok"
        ? {
            candidatePercentile: standing.candidatePercentile,
            crowdMedianPercentile: standing.crowdMedianPercentile,
            crowdSample: standing.crowdSample,
            candidateEvidenceRef: r.evidence.id,
            crowdEvidenceRefs: crowdEvidence.map((e) => e.id),
          }
        : null,
    cityStrengths: [],
    caveats,
    evidence,
  };
}

function unmatchedResult(r: Extract<Resolution, { kind: "none" | "failed" }>, key: string): ActResult {
  const caveats =
    r.kind === "none"
      ? buildCaveats({ fit: { status: "unavailable", reason: "unresolved-entity" }, standing: computeStanding(null, []) })
      : [UNAVAILABLE_CAVEAT];
  return {
    // No entity id exists; this placeholder only keeps ranking and de-duplication keyed.
    act: { qlooEntityId: key, name: r.input, matchConfidence: 0 },
    status: "no-data",
    rank: null,
    fit: null,
    overlapTags: [],
    standing: null,
    cityStrengths: [],
    caveats,
    evidence: [],
  };
}
