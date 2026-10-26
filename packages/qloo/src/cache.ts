import { getCache, getStale, putCache, type Db } from "@headliner/slates";
import { sha256Hex } from "./evidence";

/** A cached call: the reduced, shape-validated data and the Evidence recorded when it was fetched. */
export interface CacheEntry {
  readonly data: unknown;
  readonly evidence: {
    readonly endpoint: string;
    readonly redactedParams: Readonly<Record<string, string>>;
    readonly responseDigest: string;
    readonly fetchedAt: string;
  };
}

/** Storage seam (ADR 0002). Postgres in production, memory in tests and DEMO_MODE. */
export interface CacheStore {
  /** The entry if it has not expired at `now`. */
  get(key: string, now: Date): Promise<CacheEntry | null>;
  /** The entry even if expired (the stale path, ADR 0007). */
  getStale(key: string): Promise<CacheEntry | null>;
  put(key: string, entry: CacheEntry, ttlSeconds: number, now: Date): Promise<void>;
}

/** Cache key: a hash of the endpoint plus the canonical typed params (never the raw URL or any credential). */
export function cacheKey(requestKeyText: string): string {
  return `qloo:v1:${sha256Hex(requestKeyText)}`;
}

export class InMemoryCacheStore implements CacheStore {
  private readonly rows = new Map<string, { entry: CacheEntry; expiresAt: number }>();

  get size(): number {
    return this.rows.size;
  }

  async get(key: string, now: Date): Promise<CacheEntry | null> {
    const row = this.rows.get(key);
    return row && row.expiresAt > now.getTime() ? row.entry : null;
  }

  async getStale(key: string): Promise<CacheEntry | null> {
    return this.rows.get(key)?.entry ?? null;
  }

  async put(key: string, entry: CacheEntry, ttlSeconds: number, now: Date): Promise<void> {
    this.rows.set(key, { entry, expiresAt: now.getTime() + ttlSeconds * 1000 });
  }
}

/** `qloo_cache` through the M0-05 repository. A database failure is a cache miss, never a request failure. */
export class PostgresCacheStore implements CacheStore {
  constructor(private readonly db: Db) {}

  async get(key: string, now: Date): Promise<CacheEntry | null> {
    try {
      return (await getCache<CacheEntry>(this.db, key, now))?.json ?? null;
    } catch {
      return null;
    }
  }

  async getStale(key: string): Promise<CacheEntry | null> {
    try {
      return (await getStale<CacheEntry>(this.db, key))?.json ?? null;
    } catch {
      return null;
    }
  }

  async put(key: string, entry: CacheEntry, ttlSeconds: number, now: Date): Promise<void> {
    try {
      await putCache(this.db, key, entry, ttlSeconds, now);
    } catch {
      // The live answer is still good; the next call simply refetches.
    }
  }
}
