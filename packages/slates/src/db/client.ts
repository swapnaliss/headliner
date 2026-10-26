import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/** The shape every repository depends on: satisfied by the Neon driver and by PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT>;

/** Thrown only when a query is attempted with no database configured; never at import. */
export class DatabaseUnavailable extends Error {
  constructor(reason = "DATABASE_URL is not set") {
    super(`DatabaseUnavailable: ${reason}`);
    this.name = "DatabaseUnavailable";
  }
}

export const CONNECT_TIMEOUT_MS = 5_000;
export const STATEMENT_TIMEOUT_MS = 8_000;

interface Handle {
  readonly db: Db;
  readonly pool: Pool;
}

let handle: Handle | undefined;

/** Lazy, per-process client. The connection string is never logged or put in an error message. */
export function getDb(source: Record<string, string | undefined> = process.env): Db {
  if (handle) return handle.db;
  const url = source["DATABASE_URL"];
  if (!url) throw new DatabaseUnavailable();
  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    max: 5,
  });
  // A dropped idle connection must not crash the process, and the error must not carry the URL.
  pool.on("error", () => undefined);
  handle = { db: drizzle(pool), pool };
  return handle.db;
}

/** Cheap reachability probe for the deep health check. Throws on failure. */
export async function pingDb(db: Db = getDb()): Promise<void> {
  await db.execute(sql`select 1`);
}

export async function closeDb(): Promise<void> {
  const h = handle;
  handle = undefined;
  if (h) await h.pool.end();
}
