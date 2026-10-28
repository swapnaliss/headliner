// Shared pieces of the M3-04 proof: set files (zod-checked), digests, name matching, entity resolution,
// the run log, and the client factory for replay (the default mode).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { createQlooClient, FixtureTransport, InMemoryCacheStore, version as adapterVersion, type QlooClient } from "../../packages/qloo/src/index";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PROOF_DIR = join(ROOT, "evals", "proof");
export const FIXTURE_DIR = join(ROOT, "fixtures", "qloo", "proof");
export const EVIDENCE_DIR = join(ROOT, "docs", "evidence");
export const HOME_CITY_SET_PATH = join(PROOF_DIR, "home-city-set.json");
export const FIT_SET_PATH = join(PROOF_DIR, "fit-set.json");
export const RUN_LOG_PATH = join(FIXTURE_DIR, "run-log.json");
export const ADAPTER_VERSION = adapterVersion;

const homeCitySet = z.object({
  schemaVersion: z.literal(1),
  chosenOn: z.string(),
  cities: z.array(z.string().min(1)).min(4),
  resolutionRule: z.string(),
  acts: z
    .array(z.object({ name: z.string().min(1), homeCity: z.string().min(1), continent: z.string().min(1), source: z.string().min(1) }))
    .min(12),
});
export type HomeCitySet = z.infer<typeof homeCitySet>;

const fitSet = z.object({
  schemaVersion: z.literal(1),
  chosenOn: z.string(),
  rule: z.string(),
  crowds: z
    .array(
      z.object({
        id: z.string().min(1),
        description: z.string(),
        crowd: z.array(z.string().min(1)).min(4).max(6),
        sameGenre: z.array(z.string().min(1)).min(3),
        control: z.string().min(1),
      }),
    )
    .min(3),
});
export type FitSet = z.infer<typeof fitSet>;

export interface LoadedSets {
  readonly homeCity: HomeCitySet;
  readonly fit: FitSet;
  readonly homeCityDigest: string;
  readonly fitDigest: string;
}

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

export function loadSets(): LoadedSets {
  const hc = readFileSync(HOME_CITY_SET_PATH, "utf8");
  const ft = readFileSync(FIT_SET_PATH, "utf8");
  const homeCity = homeCitySet.parse(JSON.parse(hc));
  for (const a of homeCity.acts) {
    if (!homeCity.cities.includes(a.homeCity)) throw new Error(`home city ${a.homeCity} of ${a.name} is not in the set's city list`);
  }
  return { homeCity, fit: fitSet.parse(JSON.parse(ft)), homeCityDigest: sha256(hc), fitDigest: sha256(ft) };
}

/** Case, accent and punctuation-insensitive form used only to match a search hit to the listed name. */
export function normName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export type Resolution =
  | { readonly status: "resolved"; readonly entityId: string; readonly matchedName: string }
  | { readonly status: "unresolved"; readonly reason: string };

/** Resolution rule from the set file: first search hit whose name equals the listed name (normalised). */
export async function resolveName(client: QlooClient, name: string): Promise<Resolution> {
  try {
    const { data } = await client.search(name, "artist");
    const hit = data.find((e) => normName(e.name) === normName(name));
    return hit
      ? { status: "resolved", entityId: hit.entityId, matchedName: hit.name }
      : { status: "unresolved", reason: "no exact name match in search results" };
  } catch (e) {
    return { status: "unresolved", reason: `search failed: ${e instanceof Error ? e.constructor.name : "error"}` };
  }
}

export interface EndpointStats {
  readonly endpoint: string;
  readonly calls: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly maxMs: number;
}
export interface RunLog {
  readonly recordedAt: string;
  readonly adapterVersion: string;
  readonly maxConcurrent: number;
  readonly liveCalls: number;
  readonly retries: number;
  readonly statusCounts: Readonly<Record<string, number>>;
  readonly rateLimited429: number;
  readonly wallSeconds: number;
  readonly byEndpoint: readonly EndpointStats[];
}

export function loadRunLog(): RunLog {
  return JSON.parse(readFileSync(RUN_LOG_PATH, "utf8")) as RunLog;
}

/** Later one-act recordings (run-log-<date>.json beside run-log.json), oldest first. */
export function loadSupplementLogs(): RunLog[] {
  return readdirSync(FIXTURE_DIR)
    .filter((f) => /^run-log-.+\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(FIXTURE_DIR, f), "utf8")) as RunLog);
}

export function replayClient(): QlooClient {
  return createQlooClient({ transport: new FixtureTransport(FIXTURE_DIR), cache: new InMemoryCacheStore() });
}
