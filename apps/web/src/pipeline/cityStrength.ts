import {
  assertEveryNumberHasEvidence,
  CAVEAT_WORDING,
  cityStrengthFromAggregate,
  compareStrings,
  type ActResult,
  type Caveat,
  type Evidence,
  type Slate,
} from "@headliner/core";
import { fetchHeatmap, type HeatmapOutcome } from "@headliner/qloo";
import { metered } from "../budget";
import type { Runtime } from "../config";
import type { CityCaveat, CityEntry, CityStrengthResponse } from "../cityStrengthTypes";
import { ApiError, logFailure } from "../errors";
import { toEvidence } from "./createSlate";

/**
 * Lazy city strength (ADR 0004): heatmap calls run only when an act is opened and the client asks
 * for them, never during create-slate. At most 5 per request (schema), at most this many in flight
 * (cold bursts of 6 drew 429s in M1-01, BL-01 6413231989).
 */
export const CITY_CONCURRENCY = 3;

/** Runs `fn` over `items` with at most `limit` in flight; results keep input order. */
async function mapWithLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      out[index] = await fn(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const sameId = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase();

function findAct(slate: Slate, actId: string): ActResult | undefined {
  return slate.results.find((r) => sameId(r.act.qlooEntityId, actId) && !r.act.qlooEntityId.startsWith("unmatched:"));
}

/** Distinct cities, case-insensitive, first spelling kept. */
export function distinctCities(cities: readonly string[]): string[] {
  const seen = new Set<string>();
  return cities.filter((c) => {
    const key = c.normalize("NFKC").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface Resolved {
  readonly entry: CityEntry;
  readonly evidence?: Evidence;
}

function resolveOutcome(outcome: HeatmapOutcome): Resolved {
  if (outcome.status === "no_data") {
    return { entry: { city: outcome.city, status: "no_data", reason: outcome.reason, evidenceRefs: [] } };
  }
  const evidence = toEvidence(outcome.evidence);
  const summary = cityStrengthFromAggregate(outcome.aggregate);
  if (summary.meanAffinityRank === null) {
    return { entry: { city: outcome.city, status: "no_data", reason: "zero_cells", evidenceRefs: [evidence.id] }, evidence };
  }
  return {
    entry: { city: outcome.city, status: "ok", meanAffinityRank: summary.meanAffinityRank, cellCount: summary.cellCount, thin: summary.thin, evidenceRefs: [evidence.id] },
    evidence,
  };
}

/** Rebuilds one act with the given city aggregates merged in. Only aggregates are stored (ADR 0002). */
export function mergeCityStrengths(act: ActResult, resolved: readonly Resolved[]): ActResult {
  const fresh = resolved.flatMap((r) => (r.entry.status === "ok" && r.evidence ? [{ entry: r.entry, evidence: r.evidence }] : []));
  const replaced = new Set(fresh.map((f) => f.entry.city.toLowerCase()));
  const cityStrengths = [
    ...act.cityStrengths.filter((c) => !replaced.has(c.city.toLowerCase())),
    ...fresh.map(({ entry }) => ({
      city: entry.city,
      meanAffinityRank: entry.meanAffinityRank,
      cellCount: entry.cellCount,
      thinData: entry.thin,
      evidenceRefs: [...entry.evidenceRefs],
    })),
  ].sort((a, b) => compareStrings(a.city, b.city));

  const evidence = [...act.evidence];
  for (const { evidence: e } of fresh) if (!evidence.some((x) => x.id === e.id)) evidence.push(e);

  const caveats: Caveat[] = [
    ...act.caveats.filter((c) => c.type !== "thin-data"),
    ...cityStrengths.filter((c) => c.thinData).map((c): Caveat => ({ type: "thin-data", message: CAVEAT_WORDING["thin-data"], subject: c.city })),
  ];
  return { ...act, cityStrengths, evidence, caveats };
}

export interface CityStrengthParams {
  readonly slateId: string;
  readonly actId: string;
  readonly cities: readonly string[];
  readonly request: Request;
}

/**
 * The cities endpoint's work: one heatmap per city under the concurrency cap, per-city failures
 * reported as `no_data` while the others still return, aggregates merged into the stored slate.
 */
export async function loadCityStrength(rt: Runtime, params: CityStrengthParams): Promise<CityStrengthResponse> {
  const slate = await rt.store.get(params.slateId);
  const act = slate ? findAct(slate, params.actId) : undefined;
  if (!slate || !act) throw new ApiError("not_found");

  const cities = distinctCities(params.cities);
  // The budget is asked before any heatmap call; a refusal throws and nothing was fetched.
  const outcomes = await metered(rt, { route: "cities", plannedCalls: cities.length, request: params.request }, (budgeted) =>
    mapWithLimit(cities, CITY_CONCURRENCY, (city) => fetchHeatmap(budgeted.client, { entityId: act.act.qlooEntityId, city })),
  );
  const resolved = outcomes.map(resolveOutcome);

  if (resolved.some((r) => r.entry.status === "ok")) {
    try {
      // Atomic across instances (row lock in Postgres): each save re-reads the stored slate and
      // patches only this act, so two acts saved at the same moment both survive (BL-01 6434847617).
      await rt.store.updateWith(slate.id, (current) => {
        const target = findAct(current, params.actId);
        if (!target) return null;
        const merged = mergeCityStrengths(target, resolved);
        assertEveryNumberHasEvidence(merged);
        return { ...current, results: current.results.map((r) => (r === target ? merged : r)) };
      });
    } catch (e) {
      // The answer is still valid and checkable; only the saved copy is behind. The next open refetches (cached).
      logFailure("city_strength_persist_failed", e);
    }
  }

  const evidence: Evidence[] = [];
  for (const r of resolved) if (r.evidence && !evidence.some((e) => e.id === r.evidence?.id)) evidence.push(r.evidence);
  const caveats: CityCaveat[] = resolved.flatMap((r) =>
    r.entry.status === "ok" && r.entry.thin ? [{ code: "thin_city_data" as const, city: r.entry.city, message: CAVEAT_WORDING["thin-data"] }] : [],
  );
  return { status: "done", actId: act.act.qlooEntityId, cities: resolved.map((r) => r.entry), caveats, evidence };
}
