import { MAX_CITIES_PER_REQUEST, rankCities, type ActResult } from "@headliner/core";
import type { CityCaveat, CityEntry, CityNoDataReason, CityStrengthResponse } from "./cityStrengthTypes";

/** A fixed list of cities compared next to the room city (the slate stores only the room city). Plain text, ids not needed. */
export const DEFAULT_COMPARISON_CITIES = ["London", "Leipzig", "Jakarta", "Tromsø"] as const;
export const MAX_CITIES = MAX_CITIES_PER_REQUEST;

const same = (a: string, b: string): boolean => a.normalize("NFKC").toLowerCase() === b.normalize("NFKC").toLowerCase();

/** The room city first, then the defaults that are not the room city, at most MAX_CITIES in all. */
export function initialCities(roomCity: string): string[] {
  return [roomCity, ...DEFAULT_COMPARISON_CITIES.filter((c) => !same(c, roomCity))].slice(0, MAX_CITIES);
}

export type PersistedCity = ActResult["cityStrengths"][number];

export type RowState =
  | { readonly kind: "pending"; readonly city: string }
  | { readonly kind: "ok"; readonly city: string; readonly meanAffinityRank: number; readonly cellCount: number; readonly thin: boolean; readonly evidenceRefs: readonly string[] }
  | { readonly kind: "zero"; readonly city: string; readonly evidenceRefs: readonly string[] }
  | { readonly kind: "failed"; readonly city: string; readonly reason: CityNoDataReason | "network" | "refused" };

export function rowFromEntry(entry: CityEntry): RowState {
  if (entry.status === "ok") {
    return { kind: "ok", city: entry.city, meanAffinityRank: entry.meanAffinityRank, cellCount: entry.cellCount, thin: entry.thin, evidenceRefs: entry.evidenceRefs };
  }
  if (entry.reason === "zero_cells") return { kind: "zero", city: entry.city, evidenceRefs: entry.evidenceRefs };
  return { kind: "failed", city: entry.city, reason: entry.reason };
}

export function rowFromPersisted(value: PersistedCity): RowState {
  return { kind: "ok", city: value.city, meanAffinityRank: value.meanAffinityRank, cellCount: value.cellCount, thin: value.thinData, evidenceRefs: value.evidenceRefs };
}

export interface RowGroups {
  /** Enough-data cities, highest mean affinity rank first. */
  readonly ranked: Extract<RowState, { kind: "ok" }>[];
  /** Under 15 cells: their own group, never mixed into `ranked`. */
  readonly thin: Extract<RowState, { kind: "ok" }>[];
  readonly pending: Extract<RowState, { kind: "pending" }>[];
  readonly zero: Extract<RowState, { kind: "zero" }>[];
  readonly failed: Extract<RowState, { kind: "failed" }>[];
}

export function groupRows(rows: readonly RowState[]): RowGroups {
  const ok = rows.flatMap((r) => (r.kind === "ok" ? [r] : []));
  const { ranked, thin } = rankCities(ok);
  return {
    ranked,
    thin,
    pending: rows.flatMap((r) => (r.kind === "pending" ? [r] : [])),
    zero: rows.flatMap((r) => (r.kind === "zero" ? [r] : [])),
    failed: rows.flatMap((r) => (r.kind === "failed" ? [r] : [])),
  };
}

export type SectionStatus = "idle" | "loading" | "ready" | "partial" | "error";

export function sectionStatus(rows: readonly RowState[], started: boolean): SectionStatus {
  if (!started) return "idle";
  if (rows.some((r) => r.kind === "pending")) return "loading";
  const failed = rows.filter((r) => r.kind === "failed").length;
  if (rows.length > 0 && failed === rows.length) return "error";
  return failed > 0 ? "partial" : "ready";
}

/** Narrow check of an untrusted response body before the UI renders it. */
export function parseCityResponse(json: unknown): CityStrengthResponse | null {
  if (typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  if (o["status"] !== "done" || !Array.isArray(o["cities"]) || !Array.isArray(o["evidence"]) || !Array.isArray(o["caveats"])) return null;
  const cities: CityEntry[] = [];
  for (const c of o["cities"] as unknown[]) {
    if (typeof c !== "object" || c === null) return null;
    const e = c as Record<string, unknown>;
    if (typeof e["city"] !== "string" || !Array.isArray(e["evidenceRefs"])) return null;
    const refs = (e["evidenceRefs"] as unknown[]).filter((x): x is string => typeof x === "string");
    if (e["status"] === "ok" && typeof e["meanAffinityRank"] === "number" && typeof e["cellCount"] === "number" && typeof e["thin"] === "boolean") {
      cities.push({ city: e["city"], status: "ok", meanAffinityRank: e["meanAffinityRank"], cellCount: e["cellCount"], thin: e["thin"], evidenceRefs: refs });
    } else if (e["status"] === "no_data" && typeof e["reason"] === "string") {
      cities.push({ city: e["city"], status: "no_data", reason: e["reason"] as CityNoDataReason, evidenceRefs: refs });
    } else return null;
  }
  const evidence = (o["evidence"] as unknown[]).flatMap((x) => {
    if (typeof x !== "object" || x === null) return [];
    const e = x as Record<string, unknown>;
    const params = e["redactedParams"];
    if (typeof e["id"] !== "string" || typeof e["endpoint"] !== "string" || typeof e["responseDigest"] !== "string" || typeof e["fetchedAt"] !== "string") return [];
    if (typeof params !== "object" || params === null) return [];
    return [{ id: e["id"], endpoint: e["endpoint"], redactedParams: params as Record<string, string>, responseDigest: e["responseDigest"], fetchedAt: e["fetchedAt"] }];
  });
  const caveats = (o["caveats"] as unknown[]).flatMap((x): CityCaveat[] => {
    const e = x as Record<string, unknown> | null;
    return e && e["code"] === "thin_city_data" && typeof e["city"] === "string" && typeof e["message"] === "string" ? [{ code: "thin_city_data", city: e["city"], message: e["message"] }] : [];
  });
  return { status: "done", actId: typeof o["actId"] === "string" ? o["actId"] : "", cities, caveats, evidence };
}
