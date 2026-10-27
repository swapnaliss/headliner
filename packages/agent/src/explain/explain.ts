import type { Slate } from "@headliner/core";
import { z } from "zod";
import { buildSlateFacts, type FactScope } from "./facts";
import { groundingCheck } from "./grounding";
import type { BudgetLease, ExplainDeps, ExplainEvent, Explanation, FallbackReason } from "./ports";
import { buildUserPrompt, estimateInputTokens, SYSTEM_PROMPT } from "./prompt";
import { renderTemplate } from "./template";

export const DEFAULT_TIMEOUT_MS = 8_000;
/** Includes reasoning tokens for a reasoning model. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 1_500;

const ReplySchema = z.object({ sentences: z.array(z.string().min(1).max(320)).min(1).max(12) }).strict();

export interface ExplainResult extends Explanation {
  /** Set when the template was used although a model was wired: why. */
  readonly fallback?: FallbackReason;
}

class TimeoutError extends Error {}

function emit(deps: ExplainDeps, event: ExplainEvent): void {
  try {
    deps.onEvent?.(event);
  } catch {
    // an observer never breaks an explanation
  }
}

async function settleQuietly(lease: BudgetLease | null, tokens: number): Promise<void> {
  try {
    await lease?.settle(tokens);
  } catch {
    // settle never throws by contract; a broken one must not break the page
  }
}

function raceTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError("explain timeout")); // first, so a provider that rejects on abort cannot win the race
      controller.abort();
    }, ms);
  });
  return Promise.race([run(controller.signal), timeout]).finally(() => clearTimeout(timer));
}

function parseReply(text: string): string[] | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = ReplySchema.safeParse(json);
  return parsed.success ? parsed.data.sentences.map((s) => s.trim()).filter((s) => s.length > 0) : null;
}

/**
 * Explains a slate (or one act with `scope.actId`). Always returns text:
 * - the model's sentences, only when the reply is valid JSON of the expected shape and passes
 *   `groundingCheck` against the Slate (`source: "llm"`);
 * - otherwise the deterministic template (`source: "template"`): no model wired, budget refused,
 *   model error or timeout, invalid JSON, or an ungrounded reply. One model call at most.
 * The model never sees free user text and never produces a figure that reaches the page unchecked.
 */
export async function explainSlate(slate: Slate, deps: ExplainDeps = {}, scope: FactScope = {}): Promise<ExplainResult> {
  const meta: Meta = { budget: "none" };
  const result = await explainWith(slate, deps, scope, meta);
  // One summary event per explanation: source, budget decision and (when a call was made) model, tokens and cost. Never text.
  emit(deps, { event: "explain_done", source: result.source, budget: meta.budget, ...(result.fallback ? { reason: result.fallback } : {}), ...(meta.model ? { model: meta.model } : {}), ...(meta.inputTokens !== undefined ? { inputTokens: meta.inputTokens, outputTokens: meta.outputTokens ?? 0 } : {}), ...(meta.costUsd !== undefined ? { costUsd: meta.costUsd } : {}), ...(meta.violations ? { violations: meta.violations } : {}) });
  return result;
}

interface Meta {
  budget: "none" | "allow" | "deny";
  violations?: readonly string[];
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

async function explainWith(slate: Slate, deps: ExplainDeps, scope: FactScope, meta: Meta): Promise<ExplainResult> {
  const facts = buildSlateFacts(slate, scope);
  const template = renderTemplate(facts);
  const fallback = (reason: FallbackReason, violations?: readonly string[]): ExplainResult => {
    if (violations) meta.violations = violations;
    return { text: template, source: "template", fallback: reason };
  };

  const model = deps.model;
  if (!model) return fallback("no_model");

  const user = buildUserPrompt(facts);
  const cacheKey = `${SYSTEM_PROMPT.length}:${user}`;
  const cached = deps.cache?.get(cacheKey);
  if (cached !== undefined) return { text: cached, source: "llm" };

  const maxOutputTokens = deps.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const reserved = estimateInputTokens(SYSTEM_PROMPT, user) + maxOutputTokens;
  let lease: BudgetLease | null;
  try {
    lease = deps.budget ? await deps.budget(reserved) : null;
    if (deps.budget) meta.budget = lease === null ? "deny" : "allow";
    if (deps.budget && lease === null) return fallback("budget");
  } catch {
    return fallback("budget");
  }

  let used = reserved; // without a usage report the whole reservation counts
  try {
    const reply = await raceTimeout((signal) => model.generate({ system: SYSTEM_PROMPT, user, maxOutputTokens, json: true, signal }), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (model.model) meta.model = model.model;
    if (reply.costUsd !== undefined) meta.costUsd = reply.costUsd;
    if (reply.usage) {
      used = reply.usage.inputTokens + reply.usage.outputTokens;
      meta.inputTokens = reply.usage.inputTokens;
      meta.outputTokens = reply.usage.outputTokens;
    }
    const sentences = parseReply(reply.text);
    if (!sentences || sentences.length === 0) return fallback("invalid_json");
    const text = sentences.join("\n");
    const checked = groundingCheck(text, slate, { dataLimitsStated: facts.some((f) => f.kind === "caveat" || f.kind === "no-data" || (f.kind === "city" && f.thinData)) });
    if (!checked.ok) return fallback("ungrounded", checked.violations.map((v) => v.kind));
    deps.cache?.set(cacheKey, text);
    return { text, source: "llm" };
  } catch (e) {
    return fallback(e instanceof TimeoutError ? "timeout" : "error");
  } finally {
    await settleQuietly(lease, used);
  }
}

/** The deterministic template for a slate or one act, without any model: what the page shows first and when the model is off. */
export function templateFor(slate: Slate, scope: FactScope = {}): string {
  return renderTemplate(buildSlateFacts(slate, scope));
}
