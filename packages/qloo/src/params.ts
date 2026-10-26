import { z } from "zod";
import { QlooBadRequest } from "./errors";

/** Limits from ADR 0003. */
export const MAX_NAME_LENGTH = 80;
export const MAX_CROWD_IDS = 6;
export const MAX_CANDIDATE_IDS = 12;

const ARTIST = "urn:entity:artist";
const HEATMAP = "urn:heatmap";
const TRENDING_WINDOW_DAYS = 92;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A user-supplied name: trimmed, 1..80 code points, no control characters. Everything else is data. */
const name = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => s.length > 0, "name is empty")
  .refine((s) => [...s].length <= MAX_NAME_LENGTH, `name is longer than ${MAX_NAME_LENGTH} characters`)
  .refine((s) => !CONTROL.test(s), "name contains control characters");

const entityId = z
  .string()
  .regex(UUID, "not an entity id")
  .transform((s) => s.toUpperCase());

function idList(max: number) {
  return z
    .array(entityId)
    .min(1)
    .max(max * 4) // bound the raw input before de-duplicating
    .transform((ids) => [...new Set(ids)])
    .refine((ids) => ids.length <= max, `more than ${max} distinct ids`);
}

export const searchInput = z.object({ query: name, take: z.number().int().min(1).max(10).default(5) });
export const recommendInput = z.object({
  signalEntityIds: idList(MAX_CROWD_IDS),
  take: z.number().int().min(1).max(20).default(10),
});
export const compareInput = z.object({ aIds: idList(MAX_CROWD_IDS), bIds: idList(MAX_CANDIDATE_IDS) });
export const heatmapInput = z.object({ entityId: entityId, city: name });
export const trendingInput = z.object({
  signalEntityIds: idList(MAX_CROWD_IDS),
  take: z.number().int().min(1).max(20).default(10),
});

export type SearchInput = z.input<typeof searchInput>;
export type RecommendInput = z.input<typeof recommendInput>;
export type CompareInput = z.input<typeof compareInput>;
export type HeatmapInput = z.input<typeof heatmapInput>;
export type TrendingInput = z.input<typeof trendingInput>;

export interface BuiltRequest {
  readonly endpoint: string;
  readonly params: URLSearchParams;
}

/** Validate, or throw QlooBadRequest naming the failed field (never echoing the value). */
function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const fields = [...new Set(r.error.issues.map((i) => i.path.join(".") || "(input)"))].join(", ");
    throw new QlooBadRequest(`Invalid Qloo request input: ${fields}`);
  }
  return r.data;
}

/** URLSearchParams from a typed record, keys sorted: this is also the fixture-index and cache-key form. */
function toParams(record: Readonly<Record<string, string | number>>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const k of Object.keys(record).sort()) sp.set(k, String(record[k]));
  return sp;
}

export function buildSearch(input: SearchInput): BuiltRequest {
  const v = parse(searchInput, input);
  return { endpoint: "/search", params: toParams({ query: v.query, take: v.take, types: ARTIST }) };
}

export function buildRecommend(input: RecommendInput): BuiltRequest {
  const v = parse(recommendInput, input);
  return {
    endpoint: "/v2/insights",
    params: toParams({ "filter.type": ARTIST, "signal.interests.entities": v.signalEntityIds.join(","), take: v.take }),
  };
}

export function buildCompare(input: CompareInput): BuiltRequest {
  const v = parse(compareInput, input);
  return {
    endpoint: "/v2/insights/compare",
    params: toParams({
      "a.signal.interests.entities": v.aIds.join(","),
      "b.signal.interests.entities": v.bIds.join(","),
      "filter.type": ARTIST,
    }),
  };
}

export function buildHeatmap(input: HeatmapInput): BuiltRequest {
  const v = parse(heatmapInput, input);
  return {
    endpoint: "/v2/insights",
    params: toParams({ "filter.location.query": v.city, "filter.type": HEATMAP, "signal.interests.entities": v.entityId }),
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildTrending(input: TrendingInput, now: Date): BuiltRequest {
  const v = parse(trendingInput, input);
  const start = new Date(now.getTime() - TRENDING_WINDOW_DAYS * 86_400_000);
  return {
    endpoint: "/v2/trending",
    params: toParams({
      "filter.end_date": isoDate(now),
      "filter.start_date": isoDate(start),
      "filter.type": ARTIST,
      "signal.interests.entities": v.signalEntityIds.join(","),
      take: v.take,
    }),
  };
}

/** Canonical request text: endpoint plus sorted params. Used for the cache key and fixture lookup. */
export function requestKeyText(req: BuiltRequest): string {
  const sorted = new URLSearchParams([...req.params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return `${req.endpoint}?${sorted.toString()}`;
}
