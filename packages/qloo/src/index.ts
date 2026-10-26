export const version = "0.1.0";

export { createQlooClient } from "./client";
export type { QlooClient, QlooClientOptions, QlooClientStats, QlooEvent, QlooResult } from "./client";
export { cacheKey, InMemoryCacheStore, PostgresCacheStore } from "./cache";
export type { CacheEntry, CacheStore } from "./cache";
export {
  QlooBadRequest,
  QlooError,
  QlooRateLimited,
  QlooShapeError,
  QlooTimeout,
  QlooUnavailable,
} from "./errors";
export type { QlooErrorKind, QlooFailure } from "./errors";
export type { Evidence } from "./evidence";
export { MAX_CANDIDATE_IDS, MAX_CROWD_IDS, MAX_NAME_LENGTH } from "./params";
export type { CompareTag, HeatmapAggregate, RecommendedEntity, SearchEntity, TrendingEntity } from "./schemas";
export { FixtureTransport } from "./transport/fixture";
export { LiveTransport, liveTransportFromEnv, QLOO_BASE_URL } from "./transport/live";
export type { QlooTransport, TransportRequest, TransportResponse } from "./transport/types";
