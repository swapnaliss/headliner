import { cacheKey, InMemoryCacheStore, type CacheEntry, type CacheStore } from "./cache";
import { QlooBadRequest, QlooError, QlooRateLimited, QlooTimeout, QlooUnavailable } from "./errors";
import { makeEvidence, type Evidence } from "./evidence";
import { Limiter } from "./limiter";
import {
  buildCompare,
  buildHeatmap,
  buildRecommend,
  buildSearch,
  buildTrending,
  requestKeyText,
  type BuiltRequest,
} from "./params";
import {
  assertShape,
  compareResponse,
  heatmapResponse,
  insightsResponse,
  reduceCompare,
  reduceHeatmap,
  reduceInsights,
  reduceSearch,
  reduceTrending,
  searchResponse,
  trendingResponse,
  type CompareTag,
  type HeatmapAggregate,
  type RecommendedEntity,
  type SearchEntity,
  type TrendingEntity,
} from "./schemas";
import type { QlooTransport } from "./transport/types";
import type { z } from "zod";

/** Every call returns the data and the Evidence behind it. */
export interface QlooResult<T> {
  readonly data: T;
  readonly evidence: Evidence;
  /** True when Qloo failed and an expired cache entry was served instead (ADR 0007): show the banner. */
  readonly stale: boolean;
  /** True when no live call was made for this result. */
  readonly cached: boolean;
}

/** The one interface the rest of the product uses (ADR 0012). Methods are named like the harness workflows. */
export interface QlooClient {
  /** Resolve a name to entities. An empty list means "no match" (status 200, not an error). */
  search(query: string, type?: "artist"): Promise<QlooResult<SearchEntity[]>>;
  /** Artists recommended from signal entities (the slow endpoint, about 3.4 s: keep off the slate path). */
  recommend(signalEntityIds: readonly string[], take?: number): Promise<QlooResult<RecommendedEntity[]>>;
  /**
   * One list compare: the whole crowd on side A, candidates on side B. Pass ONE candidate per call:
   * several in `bIds` merge into one result (M0-02). Tags keep Qloo's repeats; `computeFit` de-duplicates.
   */
  compareAudiences(aIds: readonly string[], bIds: readonly string[]): Promise<QlooResult<CompareTag[]>>;
  /** Heatmap of an entity in a city, reduced to an aggregate (cell count, mean affinity_rank). */
  whereIsPopular(entityId: string, city: string): Promise<QlooResult<HeatmapAggregate>>;
  /**
   * `/v2/trending`. Flat in the hackathon environment (empty with a signal, 400 without one), so it
   * carries no signal for scoring and must not back a momentum claim. Kept for completeness.
   */
  trending(signalEntityIds: readonly string[], take?: number): Promise<QlooResult<TrendingEntity[]>>;
  /** Counters for budget wrappers (M2-05) and tests. */
  stats(): QlooClientStats;
}

export interface QlooClientStats {
  readonly liveCalls: number;
  readonly cacheHits: number;
  readonly staleServed: number;
}

export type QlooEvent =
  | { readonly type: "cache_hit"; readonly endpoint: string }
  | { readonly type: "live_call"; readonly endpoint: string; readonly attempt: number; readonly status: number; readonly ms: number }
  | { readonly type: "retry"; readonly endpoint: string; readonly kind: string }
  | { readonly type: "stale"; readonly endpoint: string; readonly kind: string }
  | { readonly type: "failure"; readonly endpoint: string; readonly kind: string };

export interface QlooClientOptions {
  readonly transport: QlooTransport;
  readonly cache?: CacheStore;
  readonly now?: () => Date;
  /** Per-call timeout (ADR 0007). Default 10 s. */
  readonly timeoutMs?: number;
  /** Max in-flight transport calls (ADR 0007). Default 6. */
  readonly maxConcurrent?: number;
  /** After a 429 that survives the retry, live calls are refused for this long. Default 60 s. */
  readonly rateLimitCooldownMs?: number;
  /** Cache lifetime per endpoint kind, seconds. */
  readonly ttlSeconds?: Partial<Record<"search" | "recommend" | "compare" | "heatmap" | "trending", number>>;
  /** Test seams. */
  readonly timeoutSignal?: (ms: number) => AbortSignal;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly jitterMs?: () => number;
  /** Safe operational events (no params, no bodies, no credential). */
  readonly onEvent?: (event: QlooEvent) => void;
}

const DAY = 86_400;
const DEFAULT_TTL = { search: 7 * DAY, recommend: 7 * DAY, compare: 7 * DAY, heatmap: 7 * DAY, trending: 3_600 } as const;

export function createQlooClient(options: QlooClientOptions): QlooClient {
  const { transport } = options;
  const cache = options.cache ?? new InMemoryCacheStore();
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? 10_000;
  const cooldownMs = options.rateLimitCooldownMs ?? 60_000;
  const limiter = new Limiter(options.maxConcurrent ?? 6);
  const timeoutSignal = options.timeoutSignal ?? ((ms: number) => AbortSignal.timeout(ms));
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const jitterMs = options.jitterMs ?? (() => 250 + Math.floor(Math.random() * 500));
  const ttl = { ...DEFAULT_TTL, ...options.ttlSeconds };
  const emit = (e: QlooEvent): void => {
    try {
      options.onEvent?.(e);
    } catch {
      // an observer must never break a call
    }
  };

  let liveCalls = 0;
  let cacheHits = 0;
  let staleServed = 0;
  let rateLimitedUntil = 0;
  const inFlight = new Map<string, Promise<QlooResult<unknown>>>();

  /** One attempt: limited, timed, status-mapped. Returns the untrusted JSON body of a 200. */
  async function attempt(req: BuiltRequest, attemptNo: number): Promise<unknown> {
    return limiter.run(async () => {
      const signal = timeoutSignal(timeoutMs);
      const timedOut = new Promise<never>((_, reject) => {
        const fail = (): void => reject(new QlooTimeout());
        if (signal.aborted) fail();
        else signal.addEventListener("abort", fail, { once: true });
      });
      const started = Date.now();
      liveCalls += 1;
      let status: number;
      let body: unknown;
      try {
        ({ status, body } = await Promise.race([transport.get({ endpoint: req.endpoint, params: req.params, signal }), timedOut]));
      } catch (e) {
        if (e instanceof QlooError) throw e;
        throw new QlooUnavailable("Qloo could not be reached");
      }
      emit({ type: "live_call", endpoint: req.endpoint, attempt: attemptNo, status, ms: Date.now() - started });
      if (status >= 200 && status < 300) return body;
      if (status === 429) throw new QlooRateLimited();
      if (status >= 500) throw new QlooUnavailable("Qloo is unavailable", true);
      if (status === 401 || status === 403) throw new QlooUnavailable("Qloo rejected the credentials");
      throw new QlooBadRequest();
    });
  }

  /** The initial attempt plus at most one retry, on timeout, 429 and 5xx only. */
  async function fetchWithRetry(req: BuiltRequest): Promise<unknown> {
    try {
      return await attempt(req, 1);
    } catch (e) {
      if (!(e instanceof QlooError) || !e.retryable) throw e;
      emit({ type: "retry", endpoint: req.endpoint, kind: e.kind });
      await sleep(jitterMs());
      return attempt(req, 2);
    }
  }

  async function execute<S extends z.ZodType, T>(
    req: BuiltRequest,
    kind: keyof typeof DEFAULT_TTL,
    schema: S,
    reduce: (raw: z.output<S>) => T,
  ): Promise<QlooResult<T>> {
    const text = requestKeyText(req);
    const key = cacheKey(text);

    const hit = await cache.get(key, now());
    if (hit) {
      cacheHits += 1;
      emit({ type: "cache_hit", endpoint: req.endpoint });
      return { data: hit.data as T, evidence: hit.evidence, stale: false, cached: true };
    }

    const pending = inFlight.get(key);
    if (pending) return pending as Promise<QlooResult<T>>;

    const run = (async (): Promise<QlooResult<T>> => {
      try {
        if (now().getTime() < rateLimitedUntil) throw new QlooRateLimited();
        const body = await fetchWithRetry(req);
        const data = reduce(assertShape(req.endpoint, schema, body));
        const fetchedAt = now();
        const evidence = makeEvidence(req.endpoint, req.params, data, fetchedAt);
        const entry: CacheEntry = { data, evidence };
        await cache.put(key, entry, ttl[kind], fetchedAt);
        return { data, evidence, stale: false, cached: false };
      } catch (e) {
        const err = e instanceof QlooError ? e : new QlooUnavailable("Qloo could not be reached");
        if (err instanceof QlooRateLimited) rateLimitedUntil = Math.max(rateLimitedUntil, now().getTime() + cooldownMs);
        if (err.kind === "timeout" || err.kind === "rate_limited" || err.kind === "unavailable") {
          const stale = await cache.getStale(key);
          if (stale) {
            staleServed += 1;
            emit({ type: "stale", endpoint: req.endpoint, kind: err.kind });
            return { data: stale.data as T, evidence: stale.evidence, stale: true, cached: true };
          }
        }
        emit({ type: "failure", endpoint: req.endpoint, kind: err.kind });
        throw err;
      }
    })();

    inFlight.set(key, run);
    try {
      return await run;
    } finally {
      inFlight.delete(key);
    }
  }

  return {
    // Methods are async so an invalid input rejects (QlooBadRequest) instead of throwing synchronously.
    search: async (query, type = "artist") => {
      if (type !== "artist") throw new QlooBadRequest("Only artist search is supported");
      return execute(buildSearch({ query }), "search", searchResponse, reduceSearch);
    },
    recommend: async (signalEntityIds, take) =>
      execute(buildRecommend({ signalEntityIds: [...signalEntityIds], ...(take === undefined ? {} : { take }) }), "recommend", insightsResponse, reduceInsights),
    compareAudiences: async (aIds, bIds) =>
      execute(buildCompare({ aIds: [...aIds], bIds: [...bIds] }), "compare", compareResponse, reduceCompare),
    whereIsPopular: async (entityId, city) => execute(buildHeatmap({ entityId, city }), "heatmap", heatmapResponse, reduceHeatmap),
    trending: async (signalEntityIds, take) =>
      execute(
        buildTrending({ signalEntityIds: [...signalEntityIds], ...(take === undefined ? {} : { take }) }, now()),
        "trending",
        trendingResponse,
        reduceTrending,
      ),
    stats: () => ({ liveCalls, cacheHits, staleServed }),
  };
}
