import { createExplainCache, explainSlate, templateFor, type ExplainCache, type ExplainDeps, type ExplainEvent, type Explanation } from "@headliner/agent";
import type { Slate } from "@headliner/core";
import { getRuntime, type Runtime } from "./config";
import { logLlm } from "./log";

/**
 * The explanation for a stored slate (M3-02). The model behind it is optional: with no model wired
 * (fixtures mode, no key) it is the deterministic template. Accepted model text is memoised per
 * process, so reloading a slate does not call the model again.
 */

const CACHE_KEY = Symbol.for("headliner.explainCache");
type CacheHolder = { [CACHE_KEY]?: ExplainCache | undefined };

function sharedCache(): ExplainCache {
  const holder = globalThis as CacheHolder;
  holder[CACHE_KEY] ??= createExplainCache();
  return holder[CACHE_KEY];
}

function logEvent(event: ExplainEvent): void {
  // Counts, cost and fixed labels only: never the prompt, the model's text, a name or an address.
  logLlm({
    endpoint: "explain",
    source: event.source ?? "template",
    budget: event.budget ?? "none",
    ...(event.reason ? { errorCode: event.reason } : {}),
    ...(event.model ? { model: event.model } : {}),
    ...(event.inputTokens !== undefined ? { inputTokens: event.inputTokens } : {}),
    ...(event.outputTokens !== undefined ? { outputTokens: event.outputTokens } : {}),
    ...(event.costUsd !== undefined ? { costUsd: Number(event.costUsd.toFixed(6)) } : {}),
    ...(event.violations ? { violations: event.violations } : {}),
  });
}

export function explainDeps(rt: Runtime, headers?: Headers): ExplainDeps {
  const model = rt.explainModel;
  return {
    model,
    budget: model && headers ? rt.explainBudget?.(headers) : undefined,
    cache: sharedCache(),
    onEvent: logEvent,
  };
}

export interface ExplainScope {
  readonly actId?: string | undefined;
}

/** What the page shows before (or without) the model: the template for the same facts. */
export function templateExplanation(slate: Slate, scope: ExplainScope = {}): Explanation {
  return { text: templateFor(slate, scope), source: "template" };
}

/** Never throws: any failure inside is the template. */
export async function getExplanation(slate: Slate, scope: ExplainScope = {}, headers?: Headers, rt: Runtime = getRuntime()): Promise<Explanation> {
  try {
    const { text, source } = await explainSlate(slate, explainDeps(rt, headers), scope);
    return { text, source };
  } catch {
    return templateExplanation(slate, scope);
  }
}
