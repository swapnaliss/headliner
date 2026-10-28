// Running the agent under test: intake replays, scripted models, the explain stub, and the shared trajectory checks.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createReplayProvider,
  IntakeResultSchema,
  runIntake,
  TraceSchema,
  type IntakeOutcome,
  type IntakeTrace,
  type LlmProvider,
  type LlmRequest,
  type LlmTurn,
} from "../../packages/agent/src/index";
import { scripted } from "../../packages/agent/src/intake/stubs";
import { Assertions, EVAL_TRACES, evalClient, evalTransport, INTAKE_TRACES, outgoingUrl, type EvalTransport, type TransportScript } from "./common";

export const ALLOWED_TOOLS = new Set(["propose_matches", "ask_clarification", "submit_room"]);

export function loadTrace(stem: string): IntakeTrace {
  for (const dir of [EVAL_TRACES, INTAKE_TRACES]) {
    const path = join(dir, `${stem}.json`);
    if (existsSync(path)) return TraceSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  }
  throw new Error(`no recorded trace named ${stem}`);
}

/** A provider wrapper that remembers every request the model was given (what it "saw"). */
export interface SpyProvider extends LlmProvider {
  readonly seen: LlmRequest[];
}

export function spy(inner: LlmProvider): SpyProvider {
  const seen: LlmRequest[] = [];
  return {
    model: inner.model,
    seen,
    async complete(req) {
      seen.push(req);
      return inner.complete(req);
    },
  };
}

/** A provider that must never be called (the guardrails reject before any model turn). */
export function forbidden(): SpyProvider {
  const seen: LlmRequest[] = [];
  return {
    model: "forbidden",
    seen,
    async complete(req) {
      seen.push(req);
      throw new Error("the model must not be called");
    },
  };
}

export interface IntakeRun {
  readonly outcome: IntakeOutcome;
  readonly transport: EvalTransport;
  readonly provider: SpyProvider;
}

/** Replays a recorded trace through the real `runIntake`: no key, no network. */
export async function replayTrace(trace: IntakeTrace, sentence: string, clarified: boolean, script?: TransportScript): Promise<IntakeRun> {
  const transport = evalTransport(script);
  const provider = spy(createReplayProvider(trace.turns as LlmTurn[], "recorded"));
  const outcome = await runIntake(sentence, { provider, qloo: evalClient(transport), clarified, source: "recorded" });
  return { outcome, transport, provider };
}

/** Runs the real `runIntake` with scripted model turns (a stand-in model; its answers are written in the eval). */
export async function scriptedIntake(sentence: string, turns: readonly LlmTurn[], script?: TransportScript, clarified = false): Promise<IntakeRun> {
  const transport = evalTransport(script);
  const provider = spy(scripted(turns));
  const outcome = await runIntake(sentence, { provider, qloo: evalClient(transport), clarified });
  return { outcome, transport, provider };
}

/** Qloo answers the search for `query` with one result carrying a hostile entity name (the name is untrusted third-party text). */
export function hostileSearchScript(query: string, hostileName: string): TransportScript {
  return (req) =>
    req.endpoint === "/search" && req.params.get("query")?.toLowerCase() === query.toLowerCase()
      ? { status: 200, body: { results: [{ entity_id: "E-HOSTILE-1", name: hostileName, popularity: 0.5, types: ["urn:entity:artist"], tags: [] }] } }
      : undefined;
}

export function turn(calls: readonly { name: string; args: unknown }[]): LlmTurn {
  return {
    content: null,
    toolCalls: calls.map((c, i) => ({ id: `call_${c.name}_${i}`, name: c.name, arguments: typeof c.args === "string" ? c.args : JSON.stringify(c.args) })),
    usage: { inputTokens: 100, outputTokens: 20, reasoningTokens: 0, cachedInputTokens: 0, totalTokens: 120 },
    costUsd: 0.00002,
    model: "scripted",
    finishReason: "tool_calls",
  };
}

/** Every request in a transport must be the typed search request: the same three parameters, whatever the name. */
export function typedSearchChecks(a: Assertions, transport: EvalTransport, label: string): void {
  for (const req of transport.requests) {
    a.expect(req.endpoint === "/search", `${label}: unexpected endpoint ${req.endpoint}`);
    const keys = [...req.params.keys()].sort().join(",");
    a.expect(keys === "query,take,types", `${label}: parameters are ${keys}, expected query,take,types`);
    a.expect(req.params.get("types") === "urn:entity:artist", `${label}: types parameter changed`);
    a.expect(req.params.get("take") === "5", `${label}: take parameter changed`);
    const url = outgoingUrl(req);
    const pairs = url.search.slice(1).split("&");
    a.expect(pairs.length === 3 && pairs.every((p) => p.split("=").length === 2), `${label}: the query string has extra or broken pairs`);
    a.expect(url.searchParams.get("query") === req.params.get("query"), `${label}: the name does not round-trip through the URL`);
  }
}

/** Trajectory evals (ticket): step count, clarifying questions, allowed tools, schema-valid final output, typed Qloo calls. */
export function trajectoryChecks(a: Assertions, trace: IntakeTrace, outcome: IntakeOutcome, transport: EvalTransport): void {
  a.expect(trace.turns.length <= 3, `trace has ${trace.turns.length} model turns, at most 3 allowed`);
  const calls = trace.turns.flatMap((t) => t.toolCalls);
  a.expect(calls.every((c) => ALLOWED_TOOLS.has(c.name)), "a tool outside the allowed set was called");
  a.expect(calls.filter((c) => c.name === "ask_clarification").length <= 1, "more than one clarifying question");
  a.expect(trace.turns.every((t) => t.toolCalls.filter((c) => c.name === "submit_room").length <= 1), "submit_room called twice in one turn");
  if (outcome.status === "room" || outcome.status === "clarification") {
    a.expect(outcome.steps <= 3, "outcome reports more than 3 steps");
    const valid = IntakeResultSchema.safeParse({ room: outcome.room, cities: outcome.cities, steps: outcome.steps, ...(outcome.clarification ? { clarification: outcome.clarification } : {}) });
    a.expect(valid.success, "final output does not validate against IntakeResultSchema");
  } else if (outcome.status === "deterministic" || outcome.status === "intake_failed") {
    a.expect(outcome.steps <= 3, "outcome reports more than 3 steps");
  }
  typedSearchChecks(a, transport, "qloo");
}
