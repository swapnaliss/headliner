import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as intake } from "../app/api/intake/route";
import { GET } from "../app/api/slates/[id]/route";
import { buildRuntime, setRuntimeForTests, type Runtime } from "../src/config";

// M3-05 style logs for the explanation and intake. The canary stands in for OPENAI_API_KEY.
const CANARY = "canary-openai-key-sk-test-0123456789";
const REPLIES = resolve(__dirname, "../../../fixtures/agent/explain");
function reply(name: "live-slate" | "ungrounded"): string {
  return (JSON.parse(readFileSync(resolve(REPLIES, `model-reply--${name}.json`), "utf8")) as { text: string }).text;
}
const fixturesRuntime = (extra: Partial<Runtime> = {}): Runtime => ({ ...buildRuntime({ DEMO_MODE: "fixtures" }), ...extra });

const headers = { "x-api-key": CANARY, authorization: `Bearer ${CANARY}`, "x-forwarded-for": "203.0.113.77", cookie: `s=${CANARY}` };

let lines: string[];
beforeEach(() => {
  lines = [];
  vi.stubEnv("OPENAI_API_KEY", CANARY);
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void lines.push(args.map(String).join(" ")));
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  setRuntimeForTests(undefined);
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("headliner.explainCache")];
});

const json = (): Record<string, unknown>[] => lines.filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as Record<string, unknown>);
const getSlate = (): Promise<Response> =>
  GET(new Request("http://localhost/api/slates/sample-leipzig-indie", { headers }), { params: Promise.resolve({ id: "sample-leipzig-indie" }) });

describe("structured logs for the explanation and intake", () => {
  it("writes one llm line with model, tokens, cost, source and budget, and no prompt, reply, header or key", async () => {
    const generate = vi.fn(async () => ({ text: reply("live-slate"), usage: { inputTokens: 720, outputTokens: 304 }, costUsd: 0.0001576 }));
    setRuntimeForTests(fixturesRuntime({ explainModel: { model: "gpt-5-nano", generate }, explainBudget: () => async () => ({ settle: async () => undefined }) }));
    expect((await getSlate()).status).toBe(200);
    const llm = json().find((l) => l["kind"] === "llm");
    expect(llm).toMatchObject({ endpoint: "explain", source: "llm", budget: "allow", model: "gpt-5-nano", inputTokens: 720, outputTokens: 304, costUsd: 0.000158 });
    const route = json().find((l) => l["kind"] === "route");
    expect(route).toMatchObject({ endpoint: "GET /api/slates/[id]", status: 200 });
    expect(llm?.["runId"]).toBe(route?.["runId"]);
    const all = lines.join("\n");
    for (const forbidden of [CANARY, "203.0.113.77", "Moderat", "audience-taste", "sentences"]) expect(all).not.toContain(forbidden);
  });

  it("logs the fallback reason and violation kinds only, for an ungrounded reply", async () => {
    setRuntimeForTests(fixturesRuntime({ explainModel: { model: "gpt-5-nano", generate: async () => ({ text: reply("ungrounded") }) } }));
    await getSlate();
    const llm = json().find((l) => l["kind"] === "llm");
    expect(llm).toMatchObject({ source: "template", errorCode: "ungrounded", violations: ["number", "number"] });
    const all = lines.join("\n");
    for (const forbidden of [CANARY, "Moderat", "91 out of 100"]) expect(all).not.toContain(forbidden);
  });

  it("the intake route logs a route line and never the key, a header or the sentence", async () => {
    setRuntimeForTests(fixturesRuntime());
    const res = await intake(
      new Request("http://localhost/api/intake", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ text: "Unique-sentence-xyz plays in Leipzig" }) }),
    );
    expect(res.status).toBeLessThan(500);
    expect(json().find((l) => l["kind"] === "route")).toMatchObject({ endpoint: "POST /api/intake" });
    const all = lines.join("\n");
    for (const forbidden of [CANARY, "203.0.113.77", "Unique-sentence-xyz"]) expect(all).not.toContain(forbidden);
  });
});
