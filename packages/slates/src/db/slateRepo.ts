import { and, eq, gt } from "drizzle-orm";
import type { Db } from "./client";
import { slates } from "./schema";

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
