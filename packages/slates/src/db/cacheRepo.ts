import { eq, lt, sql } from "drizzle-orm";
import type { Db } from "./client";
import { qlooCache } from "./schema";

/**
 * Qloo cache repository (ADR 0006, 0007).
 *
 * Callers must pass JSON already reduced to what the product needs. In particular heatmap values
 * are stored as aggregates only (per-city mean affinity_rank and cell count), never raw cells:
 * that is enforced by the caller's type; this repository stores whatever JSON it is given.
 */
export interface CacheRow<T> {
  key: string;
  json: T;
  expiresAt: Date;
}

function toRow<T>(r: { key: string; json: unknown; expiresAt: Date }): CacheRow<T> {
  return { key: r.key, json: r.json as T, expiresAt: r.expiresAt };
}

/** The row only if it has not expired. */
export async function getCache<T = unknown>(db: Db, key: string, now: Date = new Date()): Promise<CacheRow<T> | null> {
  const rows = await db.select().from(qlooCache).where(eq(qlooCache.key, key)).limit(1);
  const row = rows[0];
  if (!row || row.expiresAt.getTime() <= now.getTime()) return null;
  return toRow<T>(row);
}

/** The row even if expired, for the stale-cache path when Qloo is unreachable (ADR 0007). */
export async function getStale<T = unknown>(db: Db, key: string): Promise<CacheRow<T> | null> {
  const rows = await db.select().from(qlooCache).where(eq(qlooCache.key, key)).limit(1);
  const row = rows[0];
  return row ? toRow<T>(row) : null;
}

/** Upsert with a time to live in seconds. */
export async function putCache(
  db: Db,
  key: string,
  json: unknown,
  ttlSeconds: number,
  now: Date = new Date(),
): Promise<void> {
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  await db
    .insert(qlooCache)
    .values({ key, json, expiresAt })
    .onConflictDoUpdate({ target: qlooCache.key, set: { json: sql`excluded.json`, expiresAt: sql`excluded.expires_at` } });
}

/** Delete expired rows; returns how many were removed. */
export async function purgeExpired(db: Db, now: Date = new Date()): Promise<number> {
  const deleted = await db.delete(qlooCache).where(lt(qlooCache.expiresAt, now)).returning({ key: qlooCache.key });
  return deleted.length;
}
