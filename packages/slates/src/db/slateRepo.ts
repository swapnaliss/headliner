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
