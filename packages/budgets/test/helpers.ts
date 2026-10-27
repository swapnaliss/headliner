import { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Db } from "@headliner/slates";

export const MIGRATIONS = fileURLToPath(new URL("../../slates/drizzle", import.meta.url));
const ENV_FILE = fileURLToPath(new URL("../../../.env", import.meta.url));

export interface Handle {
  readonly db: Db;
  close(): Promise<void>;
}

/** A fresh in-process Postgres with the real migrations applied. */
export async function openPglite(): Promise<Handle> {
  const client = new PGlite();
  const db = drizzlePglite(client);
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return { db: db as unknown as Db, close: () => client.close() };
}

/**
 * The throwaway Neon branch named `test` (prerequisite P-14), or undefined when `TEST_DATABASE_URL`
 * is not set. Safety: refuses to run when it equals `DATABASE_URL` (production), compared in
 * process; neither value is ever printed or put in an error. The repo `.env` is loaded by Node's
 * own loader without echoing.
 */
export function testDatabaseUrl(): string | undefined {
  const before = new Set(Object.keys(process.env));
  if (existsSync(ENV_FILE)) {
    try {
      process.loadEnvFile(ENV_FILE);
    } catch {
      // no usable .env: only what the shell exported is used
    }
  }
  const test = process.env["TEST_DATABASE_URL"] || undefined;
  const prod = process.env["DATABASE_URL"] || undefined;
  // Keep nothing the loader added (keys, the production URL) in this worker's environment.
  for (const name of Object.keys(process.env)) if (!before.has(name)) delete process.env[name];
  if (test && prod && test === prod) {
    throw new Error("TEST_DATABASE_URL equals DATABASE_URL: refusing to run budget tests against production");
  }
  return test;
}

export async function openNeonTestBranch(url: string, options: { connectTimeoutMs?: number } = {}): Promise<Handle> {
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: options.connectTimeoutMs ?? 10_000, max: 20 });
  pool.on("error", () => undefined);
  const db = drizzleNeon(pool);
  return { db: db as unknown as Db, close: () => pool.end() };
}

/** Applies the real migrations to the test branch (idempotent) and returns a handle. */
export async function openMigratedTestBranch(url: string): Promise<Handle> {
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 10_000, max: 20 });
  pool.on("error", () => undefined);
  const db = drizzleNeon(pool);
  const have = await db.execute(sql`select to_regclass('public.budgets') as t`);
  const rows = (have as unknown as { rows: { t: string | null }[] }).rows;
  if (!rows[0]?.t) await migrateNeon(db, { migrationsFolder: MIGRATIONS });
  return { db: db as unknown as Db, close: () => pool.end() };
}

/** A SHA-256-shaped key for tests that call `charge` directly. */
export function fakeHash(seed: string): string {
  return Array.from({ length: 64 }, (_, i) => ((seed.charCodeAt(i % seed.length) + i) % 16).toString(16)).join("");
}
