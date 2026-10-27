import { and, eq, gt, lte } from "drizzle-orm";
import type { Db } from "./client";
import { slates } from "./schema";

export async function insertSlate(db: Db, id: string, json: unknown, createdAt: Date, expiresAt: Date): Promise<void> {
  await db.insert(slates).values({ id, json, createdAt, expiresAt });
}

/** The raw row for an id, expired or not (used by `loadSlate`, which deletes an expired row). */
export async function getSlateRow(db: Db, id: string): Promise<{ json: unknown; expiresAt: Date } | null> {
  const rows = await db.select({ json: slates.json, expiresAt: slates.expiresAt }).from(slates).where(eq(slates.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Deletes a slate only if it has expired (lazy cleanup on read; a live slate is never deleted here). */
export async function deleteSlate(db: Db, id: string, now: Date = new Date()): Promise<void> {
  await db.delete(slates).where(and(eq(slates.id, id), lte(slates.expiresAt, now)));
}

/** The stored Slate JSON for an id, only while it has not expired (30-day life, ADR 0003). */
export async function getSlateJson(db: Db, id: string, now: Date = new Date()): Promise<unknown | null> {
  const rows = await db.select().from(slates).where(eq(slates.id, id)).limit(1);
  const row = rows[0];
  if (!row || row.expiresAt.getTime() <= now.getTime()) return null;
  return row.json;
}

/**
 * Replaces the stored Slate JSON of an unexpired slate (lazy city strength adds aggregates to it,
 * M2-03). The expiry is left alone. Returns false when the slate is unknown or expired.
 */
export async function updateSlateJson(db: Db, id: string, json: unknown, now: Date = new Date()): Promise<boolean> {
  const rows = await db
    .update(slates)
    .set({ json })
    .where(and(eq(slates.id, id), gt(slates.expiresAt, now)))
    .returning({ id: slates.id });
  return rows.length > 0;
}

/**
 * Atomic read-modify-write of one unexpired slate (BL-01 6434847617). The row is locked
 * (`SELECT ... FOR UPDATE`) inside a transaction, so two serverless instances patching different
 * parts of the same slate queue up and each sees the other's write. `patch` receives the stored
 * JSON and returns the new JSON, or null to leave the row alone. Returns true only when written.
 */
export async function patchSlateJson(
  db: Db,
  id: string,
  patch: (current: unknown) => unknown | null,
  now: Date = new Date(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ json: slates.json })
      .from(slates)
      .where(and(eq(slates.id, id), gt(slates.expiresAt, now)))
      .limit(1)
      .for("update");
    const row = rows[0];
    if (!row) return false;
    const next = patch(row.json);
    if (next === null) return false;
    await tx.update(slates).set({ json: next }).where(eq(slates.id, id));
    return true;
  });
}

/**
 * Pinned slates (M2-06, ADR 0002 addendum): a sample slate is stored with this expiry, so the one
 * cleanup rule ("delete rows whose expires_at has passed") can never remove it. No extra column.
 */
export const PINNED_EXPIRES_AT = new Date("9999-12-31T23:59:59.000Z");

/** True for a row that was stored pinned. */
export function isPinnedExpiry(expiresAt: Date): boolean {
  return expiresAt.getTime() >= PINNED_EXPIRES_AT.getTime();
}

/** Insert or replace a pinned slate. Used only by the sample pre-warm script, never by a request. */
export async function putPinnedSlate(db: Db, id: string, json: unknown, now: Date = new Date()): Promise<void> {
  await db
    .insert(slates)
    .values({ id, json, createdAt: now, expiresAt: PINNED_EXPIRES_AT })
    .onConflictDoUpdate({ target: slates.id, set: { json, createdAt: now, expiresAt: PINNED_EXPIRES_AT } });
}

/** TTL cleanup: delete slates whose expiry has passed; returns how many went. Pinned rows never match. */
export async function purgeExpiredSlates(db: Db, now: Date = new Date()): Promise<number> {
  const deleted = await db.delete(slates).where(lte(slates.expiresAt, now)).returning({ id: slates.id });
  return deleted.length;
}
