import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import type { QlooEvent } from "@headliner/qloo";

/**
 * Structured console logs (ADR 0010, M3-05): one JSON object per line on stdout.
 *
 * Allowed fields only: run id, endpoint (a Qloo path or a route pattern), latency, status, cache hit, parameter
 * NAMES (never values), a budget decision and call counts. Nothing here accepts a header, a request body, an
 * address, a caught error's message or an upstream body, so none of them can reach a log line.
 */

export type BudgetDecision = "allow" | "cache_only" | "deny";

export interface QlooCounts {
  /** Transport attempts, retries included (matches the budget's `liveCalls`). */
  upstreamCalls: number;
  retries: number;
  /** Attempts answered with HTTP 429. */
  status429: number;
  cacheHits: number;
  staleServed: number;
  failures: number;
}

export interface LogFields {
  readonly runId: string;
  /** A Qloo path ("/compare") or a route pattern ("POST /api/slates"); never a concrete URL. */
  readonly endpoint: string;
  readonly latencyMs: number;
  readonly status: number;
  readonly cacheHit: boolean;
  /** Names of the query parameters sent, never their values. */
  readonly params?: readonly string[];
  readonly budget?: BudgetDecision;
  /** Fixed error code (an `ErrorCode` or an adapter error kind), never a message. */
  readonly errorCode?: string;
  /** Qloo call counts for the whole request (route lines only). */
  readonly qloo?: QlooCounts;
  readonly kind?: "route" | "qloo";
}

interface RunContext {
  readonly runId: string;
  readonly counts: QlooCounts;
  budget?: BudgetDecision;
}

const runs = new AsyncLocalStorage<RunContext>();

/** 12 hex characters of randomness: enough to correlate one request's lines, reveals nothing. */
export function newRunId(): string {
  return randomBytes(6).toString("hex");
}

const emptyCounts = (): QlooCounts => ({ upstreamCalls: 0, retries: 0, status429: 0, cacheHits: 0, staleServed: 0, failures: 0 });

/** The run id of the request in progress, if any. */
export function currentRunId(): string | undefined {
  return runs.getStore()?.runId;
}

/** Records the budget decision for the request in progress (shown on its route line). */
export function noteBudget(decision: BudgetDecision): void {
  const ctx = runs.getStore();
  if (ctx) ctx.budget = decision;
}

/** Writes one JSON line to stdout (console.log). Never throws. */
export function logEvent(fields: LogFields): void {
  try {
    console.log(JSON.stringify(fields));
  } catch {
    // logging must never break a request
  }
}

/** Adapter observer: one line per Qloo event, tagged with the current request's run id. */
export function logQlooEvent(event: QlooEvent): void {
  const ctx = runs.getStore();
  const runId = ctx?.runId ?? "none";
  const c = ctx?.counts;
  const base = { kind: "qloo", runId, endpoint: event.endpoint, params: event.params } as const;
  switch (event.type) {
    case "cache_hit":
      if (c) c.cacheHits += 1;
      logEvent({ ...base, latencyMs: 0, status: 200, cacheHit: true });
      return;
    case "live_call":
      if (c) {
        c.upstreamCalls += 1;
        if (event.status === 429) c.status429 += 1;
      }
      logEvent({ ...base, latencyMs: event.ms, status: event.status, cacheHit: false });
      return;
    case "retry":
      if (c) c.retries += 1;
      logEvent({ ...base, latencyMs: 0, status: 0, cacheHit: false, errorCode: `retry_${event.kind}` });
      return;
    case "stale":
      if (c) c.staleServed += 1;
      logEvent({ ...base, latencyMs: 0, status: 200, cacheHit: true, errorCode: `stale_${event.kind}` });
      return;
    case "failure":
      if (c) c.failures += 1;
      logEvent({ ...base, latencyMs: 0, status: 0, cacheHit: false, errorCode: event.kind });
      return;
  }
}

/** The model-turn line (M3-02), same style as the others: counts, cost and labels only, never prompt or reply text, never a key. */
export interface LlmLogFields {
  readonly endpoint: string;
  /** What the page got: the model's checked text or the template. */
  readonly source: "llm" | "template";
  readonly budget: "none" | "allow" | "deny";
  /** Fixed fallback reason (`budget`, `timeout`, `ungrounded`...), when the template was used with a model wired. */
  readonly errorCode?: string;
  readonly model?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly costUsd?: number;
  /** Grounding violation kinds (`number`, `banned`, `markup`), never the offending text. */
  readonly violations?: readonly string[];
}

export function logLlm(fields: LlmLogFields): void {
  try {
    console.log(JSON.stringify({ kind: "llm", runId: runs.getStore()?.runId ?? "none", ...fields }));
  } catch {
    // logging must never break a request
  }
}

/** The fixed error code of an error response (`{error:{code}}`), read without consuming the body. */
async function errorCodeOf(response: Response): Promise<string | undefined> {
  if (response.status < 400) return undefined;
  try {
    const body: unknown = await response.clone().json();
    const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" && /^[a-z_]{1,40}$/.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Wraps a route handler: creates the run id, runs the handler inside the request context (so adapter lines
 * and `logFailure` carry the same id), then writes the route line. A throw is logged as status 500 and rethrown.
 */
export function logged<A extends unknown[]>(endpoint: string, handler: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return async (...args: A): Promise<Response> => {
    const ctx: RunContext = { runId: newRunId(), counts: emptyCounts() };
    const started = Date.now();
    const finish = (status: number, errorCode?: string): void => {
      const c = ctx.counts;
      const touched = c.upstreamCalls + c.cacheHits + c.staleServed + c.failures > 0;
      logEvent({
        kind: "route",
        runId: ctx.runId,
        endpoint,
        latencyMs: Date.now() - started,
        status,
        cacheHit: c.cacheHits > 0 && c.upstreamCalls === 0,
        ...(ctx.budget ? { budget: ctx.budget } : {}),
        ...(errorCode ? { errorCode } : {}),
        ...(touched ? { qloo: { ...c } } : {}),
      });
    };
    return runs.run(ctx, async () => {
      let response: Response;
      try {
        response = await handler(...args);
      } catch (e) {
        finish(500, e instanceof Error ? "unhandled" : "unknown");
        throw e;
      }
      finish(response.status, await errorCodeOf(response));
      return response;
    });
  };
}
