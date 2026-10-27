/**
 * What the explanation needs from the outside world, as small injected ports. The OpenAI wrapper
 * (M3-01, `packages/agent/src/llm/`) and the budget guard (M2-05) are adapted to these in the app;
 * nothing here imports a provider SDK.
 */

export interface ModelRequest {
  readonly system: string;
  readonly user: string;
  /** Cap on output tokens (reasoning tokens count for a reasoning model). */
  readonly maxOutputTokens: number;
  /** The reply must be one JSON object. */
  readonly json: true;
  /** Aborted when the explanation's timeout passes. */
  readonly signal: AbortSignal;
}

export interface ModelReply {
  readonly text: string;
  /** Tokens billed for the call, from the provider's `usage`. Absent: the reservation is kept. */
  readonly usage?: { readonly inputTokens: number; readonly outputTokens: number };
}

export interface ExplainModel {
  generate(request: ModelRequest): Promise<ModelReply>;
}

/** A reservation of LLM tokens. `settle` replaces it with the tokens really used; it never throws. */
export interface BudgetLease {
  settle(actualTokens: number): Promise<void>;
}

/**
 * Asked before every model turn. Returns a lease, or null when the model may not be used
 * (per-IP or global ceiling reached, budget store unreachable): the caller then uses the template.
 */
export type ExplainBudget = (estimatedTokens: number) => Promise<BudgetLease | null>;

/** Why the template was used instead of model text. */
export type FallbackReason = "no_model" | "budget" | "error" | "timeout" | "invalid_json" | "ungrounded";

export interface ExplainEvent {
  readonly event: "explain_llm" | "explain_fallback";
  readonly reason?: FallbackReason;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  /** Violation kinds only, never the model's text. */
  readonly violations?: readonly string[];
}

/** Bounded memo of accepted model text, so reloading a slate does not call the model again. */
export interface ExplainCache {
  get(key: string): string | undefined;
  set(key: string, text: string): void;
}

export interface ExplainDeps {
  /** Absent (no key, fixtures mode): the template is used and no call is made. */
  readonly model?: ExplainModel | undefined;
  /** Absent: no budget check (tests, fixtures). */
  readonly budget?: ExplainBudget | undefined;
  readonly cache?: ExplainCache | undefined;
  readonly timeoutMs?: number;
  readonly maxOutputTokens?: number;
  readonly onEvent?: ((event: ExplainEvent) => void) | undefined;
}

export interface Explanation {
  readonly text: string;
  readonly source: "llm" | "template";
}

/** A small bounded cache (oldest entry out first). */
export function createExplainCache(maxEntries = 200): ExplainCache {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key),
    set(key, text) {
      map.delete(key);
      map.set(key, text);
      if (map.size > maxEntries) {
        const oldest = map.keys().next();
        if (!oldest.done) map.delete(oldest.value);
      }
    },
  };
}
