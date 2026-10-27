import { sql } from "drizzle-orm";
import type { Db } from "@headliner/slates";
import { z } from "zod";

/** The shared row that holds the day's global totals. Real keys are 64 hex characters, so no clash. */
export const GLOBAL_KEY = "global";

export interface Totals {
  readonly qlooCalls: number;
  readonly llmTokens: number;
}

export interface ChargeResult {
  /** This visitor's totals for the day after the charge. */
  readonly ip: Totals;
  /** Everyone's totals for the day after the charge. */
  readonly global: Totals;
}

export interface ChargeInput {
  /** Salted hash from `ipHash` (64 hex characters). Never a raw address. */
  readonly ipHash: string;
  /** `YYYY-MM-DD`, UTC. */
  readonly day: string;
  /** Live Qloo calls to add. Negative values give back an unused reservation (totals never go below 0). */
  readonly qlooCalls?: number;
  /** LLM tokens to add; negative gives back. */
  readonly llmTokens?: number;
}

const DELTA = z.number().int().min(-1_000_000).max(1_000_000);
const InputSchema = z.object({
  ipHash: z.string().regex(/^[0-9a-f]{64}$/),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  qlooCalls: DELTA.default(0),
  llmTokens: DELTA.default(0),
});

const RowSchema = z.object({
  ip_q: z.coerce.number(),
  ip_t: z.coerce.number(),
  g_q: z.coerce.number(),
  g_t: z.coerce.number(),
});

/**
 * Adds to this visitor's row and to the day's global row in ONE statement:
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, so 50 concurrent requests record exactly 50
 * (no read-modify-write window) and the two rows can never disagree about a charge. Returns the new
 * totals. The statement carries only the hash, the day and two integers.
 */
export async function charge(db: Db, input: ChargeInput): Promise<ChargeResult> {
  const { ipHash, day, qlooCalls, llmTokens } = InputSchema.parse(input);
  const upsert = (key: ReturnType<typeof sql>) => sql`
    INSERT INTO budgets (ip_hash, day, qloo_calls, llm_tokens)
    VALUES (${key}, ${day}::date, GREATEST(${qlooCalls}::int, 0), GREATEST(${llmTokens}::int, 0))
    ON CONFLICT (ip_hash, day) DO UPDATE SET
      qloo_calls = GREATEST(budgets.qloo_calls + ${qlooCalls}::int, 0),
      llm_tokens = GREATEST(budgets.llm_tokens + ${llmTokens}::int, 0)
    RETURNING qloo_calls, llm_tokens`;
  const result = await db.execute(sql`
    WITH g AS (${upsert(sql`${GLOBAL_KEY}::text`)}),
         i AS (${upsert(sql`${ipHash}::text`)})
    SELECT i.qloo_calls AS ip_q, i.llm_tokens AS ip_t, g.qloo_calls AS g_q, g.llm_tokens AS g_t FROM i, g`);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? (result as unknown as unknown[]);
  const row = RowSchema.parse(Array.isArray(rows) ? rows[0] : undefined);
  return { ip: { qlooCalls: row.ip_q, llmTokens: row.ip_t }, global: { qlooCalls: row.g_q, llmTokens: row.g_t } };
}
