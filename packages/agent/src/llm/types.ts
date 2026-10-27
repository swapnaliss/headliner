/**
 * The thin provider interface (ADR 0009 update 2026-10-26). Everything in the agent layer talks to a
 * model through `LlmProvider`, so changing provider or model is one file (`openai.ts`).
 * The model never computes or invents a number: callers pass structured input and validate output.
 */

export interface LlmToolCall {
  readonly id: string;
  readonly name: string;
  /** Raw JSON text exactly as the model produced it. Untrusted: validate with zod before use. */
  readonly arguments: string;
}

export type LlmMessage =
  | { readonly role: "system" | "user"; readonly content: string }
  | { readonly role: "assistant"; readonly content: string | null; readonly toolCalls?: readonly LlmToolCall[] }
  | { readonly role: "tool"; readonly toolCallId: string; readonly content: string };

export interface LlmToolDef {
  readonly name: string;
  readonly description: string;
  /** JSON Schema of the arguments object. */
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface LlmRequest {
  readonly messages: readonly LlmMessage[];
  readonly tools?: readonly LlmToolDef[];
  /** `required` makes the model call a tool every turn (small models otherwise answer in prose). Default `auto`. */
  readonly toolChoice?: "auto" | "required";
  /** Hard cap on tokens the model may generate. Reasoning tokens count against it and are billed as output. */
  readonly maxCompletionTokens: number;
  /** When set (and no tools), the provider asks for JSON that matches this schema (structured output). */
  readonly jsonSchema?: { readonly name: string; readonly schema: Readonly<Record<string, unknown>> };
}

export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Part of `outputTokens` spent on hidden reasoning. */
  readonly reasoningTokens: number;
  readonly cachedInputTokens: number;
  readonly totalTokens: number;
}

export interface LlmTurn {
  readonly content: string | null;
  readonly toolCalls: readonly LlmToolCall[];
  readonly usage: LlmUsage;
  /** Computed from `usage` and the price table in `pricing.ts` at call time. */
  readonly costUsd: number;
  readonly model: string;
  readonly finishReason: string;
}

export type LlmErrorKind = "timeout" | "unavailable" | "rejected" | "no_recording";

/** Fixed messages only: provider error text (which can echo request content) never leaves the provider. */
export class LlmError extends Error {
  constructor(readonly kind: LlmErrorKind) {
    super(`llm_${kind}`);
    this.name = "LlmError";
  }
}

export interface LlmProvider {
  readonly model: string;
  complete(request: LlmRequest): Promise<LlmTurn>;
}

export const ZERO_USAGE: LlmUsage = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cachedInputTokens: 0, totalTokens: 0 };
