import { z } from "zod";
import { QlooShapeError } from "./errors";

/**
 * One zod schema per endpoint (CLAUDE.md: Qloo silently ignores invalid parameters and returns 200,
 * so every response shape is asserted). zod objects drop unknown keys, so the parsed value is
 * already the reduced form that is cached and digested: bulky fields (biographies, links, images,
 * raw heatmap coordinates) never reach the cache.
 */

const unit = z.number().finite().min(0).max(1);

// ---------- /search ----------
const searchTag = z.object({ tag_id: z.string(), name: z.string(), type: z.string() });
const searchEntity = z.object({
  entity_id: z.string().min(1),
  name: z.string(),
  popularity: unit,
  types: z.array(z.string()),
  disambiguation: z.string().optional(),
  // Recorded fact (M1-01): lower-ranked results omit `tags`; an absent list means "no tags", not a bad shape.
  tags: z.array(searchTag).default([]),
  properties: z.object({ short_description: z.string().optional() }).optional(),
});
export const searchResponse = z.object({ results: z.array(searchEntity) });

export interface SearchEntity {
  readonly entityId: string;
  readonly name: string;
  /** Qloo popularity, 0..1 (the basis of "Qloo popularity rank" standing). */
  readonly popularity: number;
  readonly types: readonly string[];
  readonly disambiguation: string | null;
  readonly description: string | null;
  readonly tags: readonly { readonly tagId: string; readonly name: string; readonly type: string }[];
}
export function reduceSearch(raw: z.output<typeof searchResponse>): SearchEntity[] {
  return raw.results.map((e) => ({
    entityId: e.entity_id,
    name: e.name,
    popularity: e.popularity,
    types: e.types,
    disambiguation: e.disambiguation ?? null,
    description: e.properties?.short_description ?? null,
    tags: e.tags.map((t) => ({ tagId: t.tag_id, name: t.name, type: t.type })),
  }));
}

// ---------- /v2/insights (artists) ----------
const insightEntity = z.object({
  entity_id: z.string().min(1),
  name: z.string(),
  popularity: unit.optional(),
  query: z.object({ affinity: z.number().finite().optional() }).optional(),
});
export const insightsResponse = z.object({
  success: z.literal(true),
  results: z.object({ entities: z.array(insightEntity) }),
});

export interface RecommendedEntity {
  readonly entityId: string;
  readonly name: string;
  readonly popularity: number | null;
  readonly affinity: number | null;
}
export function reduceInsights(raw: z.output<typeof insightsResponse>): RecommendedEntity[] {
  return raw.results.entities.map((e) => ({
    entityId: e.entity_id,
    name: e.name,
    popularity: e.popularity ?? null,
    affinity: e.query?.affinity ?? null,
  }));
}

// ---------- /v2/insights/compare ----------
const compareTag = z.object({
  tag_id: z.string().min(1),
  name: z.string(),
  type: z.string().optional(),
  query: z.object({
    score: unit,
    "a.signal.interests.entities": z.array(z.object({ entity_id: z.string() })).optional(),
  }),
});
export const compareResponse = z.object({ results: z.object({ tags: z.array(compareTag) }) });

/**
 * A compare tag in the shape `computeFit` (packages/core) reads. Qloo repeats a tag_id (artist and
 * person entity, and per subset of the crowd); the repeats are kept, de-duplication is Fit's job
 * (ADR 0013). Only the crowd-side entity ids and the score are kept.
 */
export interface CompareTag {
  readonly tag_id: string;
  readonly name: string;
  readonly query: {
    readonly score: number;
    readonly "a.signal.interests.entities": readonly { readonly entity_id: string }[];
  };
}
export function reduceCompare(raw: z.output<typeof compareResponse>): CompareTag[] {
  return raw.results.tags.map((t) => ({
    tag_id: t.tag_id,
    name: t.name,
    query: {
      score: t.query.score,
      "a.signal.interests.entities": (t.query["a.signal.interests.entities"] ?? []).map((e) => ({ entity_id: e.entity_id })),
    },
  }));
}

// ---------- /v2/insights heatmap ----------
const heatCell = z.object({
  location: z.object({ latitude: z.number().finite(), longitude: z.number().finite(), geohash: z.string() }),
  query: z.object({ affinity: z.number().finite(), affinity_rank: z.number().finite(), popularity: z.number().finite() }),
});
export const heatmapResponse = z.object({
  success: z.literal(true),
  results: z.object({ heatmap: z.array(heatCell) }),
});

/**
 * Heatmap aggregate (ADR 0002: aggregates only, never raw grids). `affinity` and `popularity` are
 * rescaled per city and deliberately not carried; only the per-city comparable `affinity_rank`.
 * Scoring (rounding, thin-data rule) stays in packages/core `computeCityStrength`.
 */
export interface HeatmapAggregate {
  /** Cells with a usable affinity_rank (0..1). */
  readonly cellCount: number;
  /** Cells ignored because affinity_rank was outside 0..1. */
  readonly droppedCells: number;
  /** Unrounded mean affinity_rank over usable cells, or null when there are none. */
  readonly meanAffinityRank: number | null;
}
export function reduceHeatmap(raw: z.output<typeof heatmapResponse>): HeatmapAggregate {
  const ranks = raw.results.heatmap.map((c) => c.query.affinity_rank).filter((r) => r >= 0 && r <= 1);
  ranks.sort((a, b) => a - b); // order-independent float sum
  const mean = ranks.length === 0 ? null : ranks.reduce((s, r) => s + r, 0) / ranks.length;
  return { cellCount: ranks.length, droppedCells: raw.results.heatmap.length - ranks.length, meanAffinityRank: mean };
}

// ---------- /v2/trending (flat in the hackathon environment: no momentum claims) ----------
const trendingEntity = z.object({ entity_id: z.string().min(1), name: z.string() });
export const trendingResponse = z.object({ success: z.literal(true), results: z.object({ trending: z.array(trendingEntity) }) });
export interface TrendingEntity {
  readonly entityId: string;
  readonly name: string;
}
export function reduceTrending(raw: z.output<typeof trendingResponse>): TrendingEntity[] {
  return raw.results.trending.map((e) => ({ entityId: e.entity_id, name: e.name }));
}

/** Parse a body or throw QlooShapeError carrying only schema paths. */
export function assertShape<S extends z.ZodType>(endpointLabel: string, schema: S, body: unknown): z.output<S> {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new QlooShapeError(endpointLabel, [...new Set(r.error.issues.map((i) => i.path.join(".") || "(root)"))]);
  }
  return r.data;
}
