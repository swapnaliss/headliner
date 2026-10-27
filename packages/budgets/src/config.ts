import { z } from "zod";

/**
 * Budget limits (ADR 0008). Every value is overridable by an environment variable and validated
 * by zod; a malformed override is an error, never a silent fallback to "unlimited".
 *
 * Defaults and why (docs/budget.md has the arithmetic):
 * - Per IP, Qloo calls per UTC day: 150. A cold 6 crowd x 12 candidate slate costs about 39 live
 *   calls (18 searches, 12 compares and 9 retried 429s, BL-01 6413231989, n=2), so 150 allows three
 *   full cold rooms or about nine of the recorded 6 x 4 size, plus lazy city loads. Calls made
 *   again for names already cached cost 0, so a repeat visit costs less.
 * - Per IP, LLM tokens per day: 20,000 (intake plus phrasing, at most 3 intake steps, ADR 0009).
 * - Global Qloo calls per day: 2,000. The hackathon quota is unpublished; this is a conservative
 *   ceiling of about 50 cold full rooms a day, to be raised by the owner if Qloo confirms more.
 * - Global LLM tokens per day: 100,000. The provider-side cap is 5 USD (docs/budget.md); the
 *   owner re-checks this number against the chosen model's price before M3-01 ships.
 */
export const DEFAULT_LIMITS = {
  ipQlooCalls: 150,
  ipLlmTokens: 20_000,
  globalQlooCalls: 2_000,
  globalLlmTokens: 100_000,
} as const;

const limit = (fallback: number) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,9}$/, "must be a whole number of at most 9 digits")
    .transform(Number)
    .pipe(z.number().int().min(0))
    .optional()
    .transform((v) => v ?? fallback);

const EnvSchema = z.object({
  BUDGET_IP_QLOO_CALLS: limit(DEFAULT_LIMITS.ipQlooCalls),
  BUDGET_IP_LLM_TOKENS: limit(DEFAULT_LIMITS.ipLlmTokens),
  BUDGET_GLOBAL_QLOO_CALLS: limit(DEFAULT_LIMITS.globalQlooCalls),
  BUDGET_GLOBAL_LLM_TOKENS: limit(DEFAULT_LIMITS.globalLlmTokens),
  BUDGET_SALT: z.string().min(8, "BUDGET_SALT must be at least 8 characters").optional(),
});

export interface BudgetConfig {
  readonly ipQlooCalls: number;
  readonly ipLlmTokens: number;
  readonly globalQlooCalls: number;
  readonly globalLlmTokens: number;
  /** Name only is documented; the value never appears in a log, error or response. */
  readonly salt: string | undefined;
}

/** Reads limits from the environment object. Throws a `ZodError` naming the variable (never its value) when malformed. */
export function loadBudgetConfig(source: Record<string, string | undefined> = process.env): BudgetConfig {
  const blank = (name: keyof z.input<typeof EnvSchema>): string | undefined => (source[name] === "" ? undefined : source[name]);
  const parsed = EnvSchema.parse({
    BUDGET_IP_QLOO_CALLS: blank("BUDGET_IP_QLOO_CALLS"),
    BUDGET_IP_LLM_TOKENS: blank("BUDGET_IP_LLM_TOKENS"),
    BUDGET_GLOBAL_QLOO_CALLS: blank("BUDGET_GLOBAL_QLOO_CALLS"),
    BUDGET_GLOBAL_LLM_TOKENS: blank("BUDGET_GLOBAL_LLM_TOKENS"),
    BUDGET_SALT: blank("BUDGET_SALT"),
  });
  return {
    ipQlooCalls: parsed.BUDGET_IP_QLOO_CALLS,
    ipLlmTokens: parsed.BUDGET_IP_LLM_TOKENS,
    globalQlooCalls: parsed.BUDGET_GLOBAL_QLOO_CALLS,
    globalLlmTokens: parsed.BUDGET_GLOBAL_LLM_TOKENS,
    salt: parsed.BUDGET_SALT,
  };
}
