import type { LlmUsage } from "./types";

/**
 * The one place the default model lives. The owner delegated the choice (2026-10-27): `gpt-5-nano`,
 * OpenAI's cheapest listed text model on the pricing page (https://developers.openai.com/api/docs/pricing):
 * $0.05 input, $0.005 cached input, $0.40 output per 1M tokens. Its model page lists function calling,
 * structured outputs and Chat Completions as supported. NOTE: the deprecations page lists it as deprecated
 * (announced 2026-06-11, removal 2026-12-11, replacement gpt-5.6-luna); set `LLM_MODEL` to switch, and the
 * deterministic fallback covers a removed model.
 */
export const DEFAULT_LLM_MODEL = "gpt-5-nano";

/** USD per 1M tokens, from the pricing page on 2026-10-27. */
export interface ModelPrice {
  readonly input: number;
  readonly cachedInput: number;
  readonly output: number;
}

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  "gpt-5-nano": { input: 0.05, cachedInput: 0.005, output: 0.4 },
  "gpt-6-luna": { input: 0.1, cachedInput: 0.01, output: 0.5 },
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
  "gpt-5-mini": { input: 0.25, cachedInput: 0.025, output: 2.0 },
};

/** An unlisted model is priced at the highest listed rate, so a budget over-counts rather than under-counts. */
const CONSERVATIVE: ModelPrice = { input: 0.25, cachedInput: 0.25, output: 2.0 };

export function priceOf(model: string): ModelPrice {
  return MODEL_PRICES[model] ?? CONSERVATIVE;
}

/** Cost of one call in USD from the `usage` the API returned. Reasoning tokens are already inside `outputTokens`. */
export function costUsd(model: string, usage: LlmUsage): number {
  const p = priceOf(model);
  const fresh = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (fresh * p.input + usage.cachedInputTokens * p.cachedInput + usage.outputTokens * p.output) / 1_000_000;
}
