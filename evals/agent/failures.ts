// Tool-failure evals: the adapter and the model fail in every way the ticket lists. Each case must end in a typed
// outcome or the deterministic fallback, never an unhandled exception, and no upstream text (a canary string is
// planted in every error body and message) may reach the client payload or the next model prompt.
import { createReplayProvider, explainSlate, LlmError, runIntake, templateFor, type ExplainModel, type IntakeOutcome, type LlmProvider } from "../../packages/agent/src/index";
import { loadSlate } from "../../packages/agent/src/explain/testkit";
import { Assertions, evalClient, evalTransport, KEY_SHAPED, UPSTREAM_CANARY, type CaseResult, type TransportScript } from "./common";
import { scriptedIntake, spy, turn, type IntakeRun } from "./harness";

const SENTENCE = "Our 200-cap room in Leipzig follows Khruangbin.";
const lookupThenSubmit = () => [
  turn([{ name: "propose_matches", args: { name: "Khruangbin" } }]),
  turn([{ name: "submit_room", args: { city: "Leipzig", crowdActs: ["Khruangbin"], candidateActs: [], cities: [] } }]),
];
const onlyKhruangbin = (script: TransportScript): TransportScript => (req) => (req.endpoint === "/search" && req.params.get("query") === "Khruangbin" ? script(req) : undefined);

function clean(a: Assertions, label: string, payload: unknown): void {
  const text = JSON.stringify(payload);
  a.expect(!text.includes(UPSTREAM_CANARY), `${label}: upstream text reached the payload`);
  a.expect(!KEY_SHAPED.test(text), `${label}: a key-shaped string reached the payload`);
}

async function adapterFailure(id: string, script: TransportScript, toolStatus: "lookup_unavailable" | "ok", opts: { timeoutMs?: number } = {}): Promise<CaseResult> {
  const a = new Assertions();
  try {
    const transport = evalTransport(onlyKhruangbin(script));
    const provider = spy(createReplayProvider(lookupThenSubmit(), "scripted"));
    const outcome = await runIntake(SENTENCE, { provider, qloo: evalClient(transport, opts) });
    a.expect(outcome.status === "room", `outcome is ${outcome.status}, expected a room (the lookup is optional)`);
    clean(a, "outcome", outcome);
    const second = provider.seen[1];
    a.expect(second !== undefined, "the model was not given the tool result");
    const tool = second?.messages.find((m) => m.role === "tool");
    a.expect(tool?.role === "tool" && JSON.parse(tool.content).status === toolStatus, `tool status is not ${toolStatus}`);
    clean(a, "model prompt", second?.messages);
  } catch (e) {
    a.expect(false, `unhandled exception: ${e instanceof Error ? e.message : "unknown"}`);
  }
  return a.result("toolFailure", id);
}

async function providerFailure(id: string, provider: LlmProvider, expected: { status: IntakeOutcome["status"]; reason?: string }): Promise<CaseResult> {
  const a = new Assertions();
  try {
    const outcome = await runIntake(SENTENCE, { provider, qloo: evalClient(evalTransport()) });
    a.expect(outcome.status === expected.status, `status is ${outcome.status}, expected ${expected.status}`);
    if (expected.reason) a.expect("reason" in outcome && outcome.reason === expected.reason, `reason is ${"reason" in outcome ? outcome.reason : "none"}, expected ${expected.reason}`);
    clean(a, "outcome", outcome);
  } catch (e) {
    a.expect(false, `unhandled exception: ${e instanceof Error ? e.message : "unknown"}`);
  }
  return a.result("toolFailure", id);
}

const throwing = (error: Error): LlmProvider => ({ model: "scripted", complete: async () => Promise.reject(error) });

async function scriptedFailure(id: string, run: Promise<IntakeRun>, expected: { status: IntakeOutcome["status"]; reason?: string }): Promise<CaseResult> {
  const a = new Assertions();
  try {
    const { outcome, provider } = await run;
    a.expect(outcome.status === expected.status, `status is ${outcome.status}, expected ${expected.status}`);
    if (expected.reason) a.expect("reason" in outcome && outcome.reason === expected.reason, `reason is ${"reason" in outcome ? outcome.reason : "none"}, expected ${expected.reason}`);
    a.expect(provider.seen.length <= 3, "more than 3 model turns");
    clean(a, "outcome", outcome);
    // Only tool results come from outside; the model's own earlier output echoed back is not upstream text.
    clean(a, "tool results", provider.seen.flatMap((r) => r.messages.filter((m) => m.role === "tool")));
  } catch (e) {
    a.expect(false, `unhandled exception: ${e instanceof Error ? e.message : "unknown"}`);
  }
  return a.result("toolFailure", id);
}

const slate = loadSlate("sample-leipzig-indie");

async function explainFailure(id: string, model: ExplainModel, fallback: string, timeoutMs?: number): Promise<CaseResult> {
  const a = new Assertions();
  try {
    const result = await explainSlate(slate, { model, ...(timeoutMs ? { timeoutMs } : {}) });
    a.expect(result.source === "template" && result.text === templateFor(slate), "the template was not shown");
    a.expect(result.fallback === fallback, `fallback is ${result.fallback ?? "none"}, expected ${fallback}`);
    clean(a, "explanation", result);
  } catch (e) {
    a.expect(false, `unhandled exception: ${e instanceof Error ? e.message : "unknown"}`);
  }
  return a.result("toolFailure", id);
}

export async function runToolFailures(): Promise<CaseResult[]> {
  // AbortSignal.timeout timers are unref'd: without a ref'd handle the process would exit while a case waits for its timeout.
  const keepAlive = setInterval(() => undefined, 50);
  try {
    return await allToolFailures();
  } finally {
    clearInterval(keepAlive);
  }
}

async function allToolFailures(): Promise<CaseResult[]> {
  const json = (status: number, body: unknown): TransportScript => () => ({ status, body });
  const pending = new Promise<never>(() => undefined);
  return [
    await adapterFailure("adapter-timeout", () => pending, "lookup_unavailable", { timeoutMs: 20 }),
    await adapterFailure("adapter-429", json(429, { error: `${UPSTREAM_CANARY} rate limit` }), "lookup_unavailable"),
    await adapterFailure("adapter-malformed-shape", json(200, { results: UPSTREAM_CANARY }), "lookup_unavailable"),
    await adapterFailure("adapter-empty-results", json(200, { results: [] }), "ok"),
    await adapterFailure("adapter-5xx", json(503, { message: UPSTREAM_CANARY }), "lookup_unavailable"),
    await adapterFailure("adapter-not-json", () => ({ status: 200, body: undefined }), "lookup_unavailable"),
    await providerFailure("llm-5xx", throwing(new LlmError("unavailable")), { status: "deterministic", reason: "llm_error" }),
    await providerFailure("llm-raw-error-text", throwing(new Error(`500 ${UPSTREAM_CANARY} Authorization: Bearer sk-live-0123456789abcdef`)), { status: "deterministic", reason: "llm_error" }),
    await providerFailure("llm-timeout", throwing(new LlmError("timeout")), { status: "deterministic", reason: "llm_error" }),
    await scriptedFailure("llm-invalid-json-arguments", scriptedIntake(SENTENCE, [turn([{ name: "submit_room", args: `{"city": ${UPSTREAM_CANARY} not json` }])]), { status: "intake_failed", reason: "invalid_output" }),
    await scriptedFailure("llm-prose-instead-of-tool", scriptedIntake(SENTENCE, [{ ...turn([]), content: `I cannot do that. ${UPSTREAM_CANARY}`, finishReason: "stop" }]), { status: "intake_failed", reason: "invalid_output" }),
    await explainFailure("explain-llm-5xx", { model: "scripted", generate: async () => Promise.reject(new Error(`500 ${UPSTREAM_CANARY}`)) }, "error"),
    await explainFailure("explain-llm-invalid-json", { model: "scripted", generate: async () => ({ text: `not json ${UPSTREAM_CANARY}` }) }, "invalid_json"),
    await explainFailure("explain-llm-wrong-shape", { model: "scripted", generate: async () => ({ text: JSON.stringify({ sentences: "one string" }) }) }, "invalid_json"),
    await explainFailure("explain-llm-timeout", { model: "scripted", generate: () => pending }, "timeout", 20),
  ];
}
