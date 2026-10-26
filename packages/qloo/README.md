# @headliner/qloo

The only module that talks to Qloo (ADR 0012, 0007, 0002, 0008). The product imports `createQlooClient` and the `QlooClient` interface; it never builds a Qloo URL or reads the key. Every call validates its input with zod, builds the query with `URLSearchParams` from a typed object (names capped at 80 characters, 6 crowd ids, 12 candidate ids, ADR 0003), asserts the response shape with a per-endpoint zod schema (Qloo ignores invalid parameters and still returns 200), reads through the cache (`qloo_cache` in Postgres, or memory) and returns the reduced data with its `Evidence`. Reliability: 10 s timeout, one retry with 250-750 ms jitter on timeout, 429 and 5xx only, at most 6 calls in flight, identical concurrent requests share one call. A 429 that survives the retry starts a 60 s cooldown during which live calls are refused locally (Qloo sends no rate-limit headers, so the quota cannot be read from responses: a budget wrapper such as M2-05 counts `client.stats().liveCalls` or wraps the transport). When Qloo fails (timeout, 429, unavailable) and an expired entry exists, that entry is returned with `stale: true` (ADR 0007).

The transport is a seam: `LiveTransport({ apiKey })` (the key comes from server env via `liveTransportFromEnv()`, the credential header is set only in `src/transport/live.ts`, the host is fixed to `hackathon.api.qloo.com`) and `FixtureTransport` (replays `fixtures/qloo/` by endpoint plus sorted params; needs no key, DB or network; a request with no recording fails with `QlooUnavailable`, nothing is invented). `DEMO_MODE=fixtures` uses `FixtureTransport` with `InMemoryCacheStore`. `Evidence` is `{ endpoint, redactedParams, responseDigest, fetchedAt }`: the digest is SHA-256 of the canonical JSON of the validated, reduced response that was cached, so a cache hit returns the original evidence. The credential, upstream bodies and upstream headers are never stored, logged, returned or put in an error message.

Errors are a closed union, all extending `QlooError` (`kind`, `retryable`, a safe `message`): `QlooTimeout` (`timeout`), `QlooRateLimited` (`rate_limited`), `QlooUnavailable` (`unavailable`, also 401/403 and transport failures), `QlooShapeError` (`shape`, carries schema `paths` only), `QlooBadRequest` (`bad_request`, invalid input or a 4xx). Invalid input rejects before any call.

## Interface

```ts
interface QlooResult<T> { data: T; evidence: Evidence; stale: boolean; cached: boolean }

interface QlooClient {
  search(query: string, type?: "artist"): Promise<QlooResult<SearchEntity[]>>;       // [] = no match (200)
  recommend(signalEntityIds: readonly string[], take?: number): Promise<QlooResult<RecommendedEntity[]>>; // /v2/insights, ~3.4 s
  compareAudiences(aIds: readonly string[], bIds: readonly string[]): Promise<QlooResult<CompareTag[]>>; // whole crowd on a, ONE candidate on b
  whereIsPopular(entityId: string, city: string): Promise<QlooResult<HeatmapAggregate>>;                  // heatmap, aggregate only
  trending(signalEntityIds: readonly string[], take?: number): Promise<QlooResult<TrendingEntity[]>>;    // flat: no momentum claims
  stats(): { liveCalls: number; cacheHits: number; staleServed: number };
}
createQlooClient({ transport, cache?, now?, timeoutMs?, maxConcurrent?, rateLimitCooldownMs?, ttlSeconds?, onEvent? }): QlooClient
```

Data shapes: `SearchEntity { entityId, name, popularity (0..1), types, disambiguation|null, description|null, tags[] }`; `CompareTag { tag_id, name, query: { score, "a.signal.interests.entities": { entity_id }[] } }` (the shape `computeFit` in `packages/core` reads; Qloo's repeats per `tag_id` are kept and de-duplicated by Fit); `HeatmapAggregate { cellCount, droppedCells, meanAffinityRank|null }` (no coordinates, ADR 0002; `affinity` and `popularity` are rescaled per city and not carried). Default cache lifetimes: 7 days for search, compare, insights and heatmap; 1 hour for trending.

Tests replay the recorded fixtures offline (`npm test -w packages/qloo`). The live smoke test runs only with `QLOO_LIVE=1` and `QLOO_API_KEY` in the environment (`npm run smoke:live -w packages/qloo`).
