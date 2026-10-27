import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { runs } from "./schema";

/** A pending run lives one hour: long enough to confirm matches, short enough to hold no stale state. */
export const RUN_TTL_MS = 60 * 60 * 1000;

export async function putRunJson(db: Db, id: string, json: unknown, now: Date = new Date()): Promise<void> {
  await db.insert(runs).values({ id, json, createdAt: now, expiresAt: new Date(now.getTime() + RUN_TTL_MS) });
}

/** The stored run JSON for an id, only while it has not expired. */
export async function getRunJson(db: Db, id: string, now: Date = new Date()): Promise<unknown | null> {
  const rows = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  const row = rows[0];
  if (!row || row.expiresAt.getTime() <= now.getTime()) return null;
  return row.json;
}

export async function deleteRun(db: Db, id: string): Promise<void> {
  await db.delete(runs).where(eq(runs.id, id));
}
