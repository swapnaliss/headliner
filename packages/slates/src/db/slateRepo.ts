import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { slates } from "./schema";

/** The stored Slate JSON for an id, only while it has not expired (30-day life, ADR 0003). */
export async function getSlateJson(db: Db, id: string, now: Date = new Date()): Promise<unknown | null> {
  const rows = await db.select().from(slates).where(eq(slates.id, id)).limit(1);
  const row = rows[0];
  if (!row || row.expiresAt.getTime() <= now.getTime()) return null;
  return row.json;
}
