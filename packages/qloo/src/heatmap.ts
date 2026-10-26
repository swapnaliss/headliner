import type { QlooClient } from "./client";
import { QlooError, type QlooErrorKind } from "./errors";
import type { Evidence } from "./evidence";
import type { HeatmapAggregate } from "./schemas";

/**
 * City strength lookup (M2-03): `/v2/insights` with `filter.type=urn:heatmap`,
 * `filter.location.query=<city>` and `signal.interests.entities=<id>`. Parameters are built from
 * a typed object by `buildHeatmap` (URLSearchParams, names validated), the response shape is
 * asserted on every call (`results.heatmap[]` cells with `location` and
 * `query.{affinity, affinity_rank, popularity}`), and the cache read-through lives in the client.
 *
 * Only the aggregate (cell count, mean affinity_rank) leaves the adapter: the grid and its
 * coordinates are discarded before caching (ADR 0002).
 */
export interface HeatmapInput {
  readonly entityId: string;
  readonly city: string;
}

/** Why a city has no usable answer. Never carries an upstream message, body or URL. */
export type NoDataReason = QlooErrorKind;

export type HeatmapOutcome =
  | {
      readonly status: "ok";
      readonly city: string;
      readonly aggregate: HeatmapAggregate;
      readonly evidence: Evidence;
      readonly stale: boolean;
      readonly cached: boolean;
    }
  | {
      /** A failed or malformed answer (shape assertion, timeout, rate limit, rejection): the city is skipped, the caller keeps going. */
      readonly status: "no_data";
      readonly city: string;
      readonly reason: NoDataReason;
    };

/** One heatmap call. An adapter failure is a `no_data` outcome for that city, never a crash. */
export async function fetchHeatmap(client: Pick<QlooClient, "whereIsPopular">, input: HeatmapInput): Promise<HeatmapOutcome> {
  try {
    const result = await client.whereIsPopular(input.entityId, input.city);
    return { status: "ok", city: input.city, aggregate: result.data, evidence: result.evidence, stale: result.stale, cached: result.cached };
  } catch (e) {
    if (e instanceof QlooError) return { status: "no_data", city: input.city, reason: e.kind };
    throw e;
  }
}
