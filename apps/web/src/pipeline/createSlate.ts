import { createHash } from "node:crypto";
import {
  assertEveryNumberHasEvidence,
  buildCaveats,
  classifyMatch,
  computeStanding,
  fitForCandidate,
  MATCH_CONFIDENCE,
  MIN_CANDIDATE_ACTS,
  MIN_CROWD_ACTS,
  rankActs,
  type Act,
  type ActResult,
  type Caveat,
  type Choice,
  type CreateSlateRequest,
  type Evidence,
  type FitResult,
  type MatchCandidate,
  type MatchRow,
  type MatchRowState,
  type Run,
  type Slate,
  type SlateNote,
} from "@headliner/core";
import { QlooError, QlooRateLimited, type Evidence as QlooEvidence, type QlooResult, type SearchEntity } from "@headliner/qloo";
import type { Runtime } from "../config";
import { ApiError } from "../errors";
import { newSlateId } from "../slateStore";

/**
 * Create-slate pipeline (ADR 0004): match -> (confirm) -> compare -> score -> rank. Matching is the
 * `classifyMatch` rule from core: an exact top hit resolves by itself; anything else waits for the
 * user (`awaiting_confirmation`), with no compare call made. Scores come from `@headliner/core`;
 * nothing here computes a number.
 */

/** Wall-clock budget for the whole run. Compares not started by then become `no-data`. */
export const DEFAULT_BUDGET_MS = 45_000;

const UNAVAILABLE_CAVEAT: Caveat = {
  type: "no-data",
  message: "No Qloo data is available for this act right now, so no audience-taste fit is shown.",
};
const BUDGET_CAVEAT: Caveat = {
  type: "no-data",
  message: "This act was not scored within the time limit for one run, so no audience-taste fit is shown.",
};

export const NOTE_WORDING = {
  "merged-duplicate": "Typed more than once; both entries are the same Qloo artist and count once.",
  "already-in-crowd": "Already in your crowd, so it is not scored against itself.",
  skipped: "Skipped by you, so it is not part of this slate.",
} as const;

/** A row as sent to the client: the Qloo search evidence stays server-side. Strings are untrusted: render as plain text. */
export interface PublicMatch {
  readonly role: "crowd" | "candidate";
  readonly actInput: string;
  readonly state: MatchRowState;
  readonly candidates: readonly MatchCandidate[];
}

export interface PublicRun {
  readonly runId: string;
  readonly room: { readonly city: string; readonly locationDisplay: string };
  readonly matches: readonly PublicMatch[];
}

export type CreateSlateOutcome =
  | {
      readonly status: "done";
      readonly id: string;
      readonly slate: Slate;
      /** True when any Qloo result came from an expired cache entry (ADR 0007). */
      readonly stale: boolean;
    }
  | ({ readonly status: "awaiting_confirmation" } & PublicRun);

export interface CreateSlateOptions {
  readonly budgetMs?: number;
  readonly clock?: () => number;
}

/** Lower-case, accent-free, punctuation-free form used to spot a repeated name in one request. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The city string exactly as the heatmap `filter.location.query` will receive it (no geocoding). */
export function locationDisplay(city: string): string {
  return city.trim();
}

function evidenceId(endpoint: string, params: Readonly<Record<string, string>>): string {
  const sorted = Object.entries(params).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `ev-${createHash("sha256").update(`${endpoint}?${JSON.stringify(sorted)}`).digest("hex").slice(0, 12)}`;
}

export function toEvidence(q: QlooEvidence): Evidence {
  return { id: evidenceId(q.endpoint, q.redactedParams), endpoint: q.endpoint, redactedParams: { ...q.redactedParams }, responseDigest: q.responseDigest, fetchedAt: q.fetchedAt };
}

/**
 * A stored slate is shareable (ADR 0008), so it never keeps what the user typed. The search that
 * found an act carried the typed text as `query`; the saved copy shows the resolved Qloo name there
 * instead, and the evidence id is recomputed from the saved parameters so references stay consistent.
 */
function shareable(evidence: Evidence, resolvedName: string): Evidence {
  if (evidence.endpoint !== "/search" || evidence.redactedParams["query"] === undefined) return evidence;
  const redactedParams = { ...evidence.redactedParams, query: resolvedName };
  return { ...evidence, id: evidenceId(evidence.endpoint, redactedParams), redactedParams };
}

function dedupeEvidence(items: readonly Evidence[]): Evidence[] {
  const seen = new Set<string>();
  return items.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
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

interface Searched {
  readonly row: MatchRow;
  readonly rateLimited: boolean;
}

/** Search one typed name and classify it. A failed search is a row state, never a guess. */
async function matchRow(rt: Runtime, role: "crowd" | "candidate", actInput: string, stale: { value: boolean }): Promise<Searched> {
  let found: QlooResult<SearchEntity[]>;
  try {
    found = await rt.client.search(actInput);
  } catch (e) {
    if (!(e instanceof QlooError)) throw e;
    // Fixtures mode has no upstream: a name without a recording is honestly "not in the recordings".
    const state: MatchRowState = rt.mode === "fixtures" ? "not-in-recordings" : "search-failed";
    return { row: { role, actInput, state, candidates: [], evidence: null }, rateLimited: e instanceof QlooRateLimited };
  }
  if (found.stale) stale.value = true;
  const verdict = classifyMatch(actInput, found.data);
  return { row: { role, actInput, state: verdict.state, candidates: [...verdict.candidates], evidence: toEvidence(found.evidence) }, rateLimited: false };
}

interface Resolved {
  readonly role: "crowd" | "candidate";
  readonly input: string;
  readonly entity: { readonly entityId: string; readonly name: string; readonly popularity: number };
  readonly confidence: number;
  readonly evidence: Evidence;
}

type Compare = { readonly kind: "ok"; readonly tags: Awaited<ReturnType<Runtime["client"]["compareAudiences"]>>["data"]; readonly evidence: Evidence } | { readonly kind: "failed" } | { readonly kind: "skipped" };

export async function createSlate(request: CreateSlateRequest, rt: Runtime, options: CreateSlateOptions = {}): Promise<CreateSlateOutcome> {
  const stale = { value: false };

  // A name repeated in the request is one act (compared case- and accent-insensitively).
  const crowdNames = firstByKey(request.crowdActs, normalizeName);
  const candidateNames = firstByKey(request.candidateActs, normalizeName);

  const searched = await Promise.all([
    ...crowdNames.map((n) => matchRow(rt, "crowd", n, stale)),
    ...candidateNames.map((n) => matchRow(rt, "candidate", n, stale)),
  ]);
  const rows = searched.map((s) => s.row);

  const crowdSearched = searched.filter((s) => s.row.role === "crowd");
  if (rt.mode === "live" && crowdSearched.length > 0 && crowdSearched.every((s) => s.row.state === "search-failed")) {
    // Every crowd search failed upstream: the caller should retry, there is nothing to confirm.
    throw new ApiError(crowdSearched.some((s) => s.rateLimited) ? "rate_limited" : "upstream_unavailable");
  }

  if (rows.some((r) => r.state !== "exact")) {
    const run: Run = { id: newSlateId(), request, matches: rows, createdAt: rt.now().toISOString(), stale: stale.value };
    try {
      await rt.runs.save(run);
    } catch {
      throw new ApiError("internal_error");
    }
    return { status: "awaiting_confirmation", ...publicRun(run) };
  }

  const resolved = rows.map((row) => resolveExact(row));
  return finish(request, resolved, [], rt, stale, options);
}

export function publicRun(run: Run): PublicRun {
  return {
    runId: run.id,
    room: { city: run.request.city, locationDisplay: locationDisplay(run.request.city) },
    matches: run.matches.map((m) => ({ role: m.role, actInput: m.actInput, state: m.state, candidates: m.candidates })),
  };
}

function resolveExact(row: MatchRow): Resolved {
  const hit = row.candidates[0];
  if (!hit || !row.evidence) throw new ApiError("internal_error");
  return { role: row.role, input: row.actInput, entity: hit, confidence: MATCH_CONFIDENCE.exact, evidence: shareable(row.evidence, hit.name) };
}

/**
 * Apply the user's choices to a stored run and score it. Every `entityId` must be one of the
 * candidates this server returned for that name (never trusted from the client), and every row
 * that is not an exact match needs exactly one choice.
 */
export async function confirmRun(runId: string, choices: readonly Choice[], rt: Runtime, options: CreateSlateOptions = {}): Promise<CreateSlateOutcome> {
  const run = await rt.runs.get(runId);
  if (!run) throw new ApiError("not_found");

  const byInput = new Map<string, Choice>();
  for (const c of choices) {
    if (byInput.has(c.actInput)) throw new ApiError("invalid_input", "Check: choices.");
    byInput.set(c.actInput, c);
  }
  const needsChoice = new Set(run.matches.filter((m) => m.state !== "exact").map((m) => m.actInput));
  for (const input of byInput.keys()) {
    if (!needsChoice.has(input)) throw new ApiError("invalid_input", "Check: choices.");
  }

  const resolved: Resolved[] = [];
  const notes: SlateNote[] = [];
  for (const row of run.matches) {
    if (row.state === "exact") {
      resolved.push(resolveExact(row));
      continue;
    }
    const choice = byInput.get(row.actInput);
    if (!choice) throw new ApiError("invalid_input", "Check: choices.");
    if (choice.entityId === "skip") {
      // No subject: the typed text is never stored, and a skipped name has no resolved Qloo name.
      notes.push({ type: "skipped", message: NOTE_WORDING.skipped });
      continue;
    }
    const picked = row.candidates.find((c) => c.entityId.toUpperCase() === choice.entityId.toUpperCase());
    if (!picked || !row.evidence) throw new ApiError("invalid_input", "Check: choices.");
    resolved.push({ role: row.role, input: row.actInput, entity: picked, confidence: MATCH_CONFIDENCE.chosenByUser, evidence: shareable(row.evidence, picked.name) });
  }

  if (resolved.filter((r) => r.role === "crowd").length < MIN_CROWD_ACTS || resolved.filter((r) => r.role === "candidate").length < MIN_CANDIDATE_ACTS) {
    throw new ApiError("invalid_input", "Too few acts remain after skipping.");
  }

  const outcome = await finish(run.request, resolved, notes, rt, { value: run.stale }, options);
  await rt.runs.remove(runId).catch(() => undefined);
  return outcome;
}

/** Compare, score and rank resolved acts, then save the slate. */
async function finish(
  request: CreateSlateRequest,
  resolved: readonly Resolved[],
  priorNotes: readonly SlateNote[],
  rt: Runtime,
  stale: { value: boolean },
  options: CreateSlateOptions,
): Promise<CreateSlateOutcome> {
  const clock = options.clock ?? Date.now;
  const deadline = clock() + (options.budgetMs ?? DEFAULT_BUDGET_MS);
  const notes: SlateNote[] = [...priorNotes];
  const key = (r: Resolved): string => r.entity.entityId.toUpperCase();

  // Two inputs resolving to one entity are one act, with a visible note.
  const crowd = firstByKey(resolved.filter((r) => r.role === "crowd"), (r) => {
    return key(r);
  });
  for (const r of resolved.filter((x) => x.role === "crowd")) {
    if (!crowd.includes(r)) notes.push({ type: "merged-duplicate", message: NOTE_WORDING["merged-duplicate"], subject: r.entity.name });
  }
  const crowdKeys = new Set(crowd.map(key));
  const candidates = firstByKey(resolved.filter((r) => r.role === "candidate"), key);
  for (const r of resolved.filter((x) => x.role === "candidate")) {
    if (!candidates.includes(r)) notes.push({ type: "merged-duplicate", message: NOTE_WORDING["merged-duplicate"], subject: r.entity.name });
  }
  // A candidate equal to a crowd act is never scored against itself.
  const scorable = candidates.filter((r) => {
    if (!crowdKeys.has(key(r))) return true;
    notes.push({ type: "already-in-crowd", message: NOTE_WORDING["already-in-crowd"], subject: r.entity.name });
    return false;
  });

  const crowdIds = crowd.map((r) => r.entity.entityId);
  const crowdEvidence = crowd.map((r) => r.evidence);
  const crowdPopularity = crowd.map((r) => r.entity.popularity);
  const crowdActs: Act[] = crowd.map((r) => ({ qlooEntityId: r.entity.entityId, name: r.entity.name, matchConfidence: r.confidence }));

  // One compare per distinct candidate (a list compare merges several candidates).
  const compares = new Map<string, Compare>();
  await Promise.all(
    scorable.map(async (r): Promise<void> => {
      if (crowd.length === 0 || clock() > deadline) {
        compares.set(key(r), { kind: "skipped" });
        return;
      }
      try {
        const res = await rt.client.compareAudiences(crowdIds, [r.entity.entityId]);
        if (res.stale) stale.value = true;
        compares.set(key(r), { kind: "ok", tags: res.data, evidence: toEvidence(res.evidence) });
      } catch (e) {
        if (!(e instanceof QlooError)) throw e;
        compares.set(key(r), { kind: "failed" });
      }
    }),
  );

  const results = scorable.map((r) => scoreMatched(r, compares.get(key(r)) ?? { kind: "skipped" }, crowdIds, crowdEvidence, crowdPopularity, clock() > deadline));
  const ranked = rankActs(results);
  for (const result of ranked) assertEveryNumberHasEvidence(result);

  const id = newSlateId();
  const slate: Slate = { id, room: { city: request.city, crowdActs }, results: ranked, notes, createdAt: rt.now().toISOString() };
  try {
    await rt.store.save(slate);
  } catch {
    throw new ApiError("internal_error");
  }
  return { status: "done", id, slate, stale: stale.value };
}

function scoreMatched(
  r: Resolved,
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
