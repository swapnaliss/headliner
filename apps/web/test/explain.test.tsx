import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExplainModel } from "@headliner/agent";
import type { GuardDecision } from "@headliner/budgets";
import { GET } from "../app/api/slates/[id]/route";
import RootLayout from "../app/layout";
import { llmBudgetFrom } from "../src/budget";
import { explainModelFrom } from "../src/explainModel";
import { buildRuntime, setRuntimeForTests, type Runtime } from "../src/config";
import { Explanation } from "../src/ui/Explanation";
import { SlateView } from "../src/ui/SlateView";

afterEach(() => {
  setRuntimeForTests(undefined);
  // The accepted-text memo is per process; each case starts without it.
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("headliner.explainCache")];
});

const REPLIES = resolve(__dirname, "../../../fixtures/agent/explain");
function reply(name: "live-slate" | "live-act" | "live-act-rejected" | "ungrounded"): string {
  return (JSON.parse(readFileSync(resolve(REPLIES, `model-reply--${name}.json`), "utf8")) as { text: string }).text;
}

function fixturesRuntime(extra: Partial<Runtime> = {}): Runtime {
  return { ...buildRuntime({ DEMO_MODE: "fixtures" }), ...extra };
}

async function call(id: string, headers: HeadersInit = {}): Promise<Response> {
  return GET(new Request(`http://localhost/api/slates/${id}`, { headers }), { params: Promise.resolve({ id }) });
}

describe("Explanation component", () => {
  it("renders <script> and markdown in a fact as literal text", () => {
    const text = '<script>alert(1)</script> ranks 1\n**Moderat** [link](http://x.test) `code` # heading';
    const html = renderToStaticMarkup(<Explanation text={text} source="template" />);
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; ranks 1");
    expect(html).toContain("**Moderat** [link](http://x.test) `code` # heading");
    expect(html).not.toContain("<strong");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<code");
    expect(html).not.toContain("<h1");
  });

  it("labels the source: template or written from checked facts", () => {
    const t = renderToStaticMarkup(<Explanation text="a" source="template" />);
    const l = renderToStaticMarkup(<Explanation text="a" source="llm" />);
    expect(t).toContain("Template.");
    expect(t).toContain('data-source="template"');
    expect(l).toContain("Written from checked facts.");
    expect(l).toContain('data-source="llm"');
  });

  it("marks the Suspense fallback pending and the final block settled (#28)", () => {
    const pending = renderToStaticMarkup(<Explanation text="a" source="template" pending />);
    const settled = renderToStaticMarkup(<Explanation text="a" source="template" />);
    expect(pending).toContain('data-state="pending"');
    expect(settled).toContain('data-state="settled"');
  });

  it("one line is one paragraph, and the block has a named heading", () => {
    const html = renderToStaticMarkup(<Explanation text={"one\n\ntwo"} source="template" />);
    expect(html.match(/<p dir="auto">/g)).toHaveLength(2);
    expect(html).toContain('aria-labelledby="explanation-heading"');
    expect(html).toContain('<h2 id="explanation-heading">Explanation</h2>');
  });

  it("sits in the slate screen under the unchanged banner", async () => {
    const rt = fixturesRuntime();
    const slate = await rt.store.get("sample-leipzig-indie");
    if (!slate) throw new Error("sample missing");
    const html = renderToStaticMarkup(
      <RootLayout>
        <SlateView slate={slate} shared explanation={<Explanation text="Moderat ranks 1." source="template" />} />
      </RootLayout>,
    );
    expect(html).toContain("aggregate affinity, not a ticket forecast");
    expect(html).toContain('data-testid="explanation"');
    // Reskin (screen-slate.md): the ranked list comes first and the explanation follows it.
    expect(html.indexOf("ranked-heading")).toBeLessThan(html.indexOf("explanation-heading"));
  });
});

describe("GET /api/slates/:id", () => {
  it("with no key in fixtures mode returns the template explanation for the sample", async () => {
    setRuntimeForTests(fixturesRuntime());
    const res = await call("sample-leipzig-indie");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { explanation: { source: string; text: string }; city: string };
    expect(body.explanation.source).toBe("template");
    expect(body.explanation.text).toContain("Moderat ranks 1 with an audience-taste fit of 63.8");
    expect(body.city).toBe("Leipzig");
    expect(JSON.stringify(body)).not.toMatch(/forecast|turnout|will sell/i);
  });

  it("returns not_found for a malformed or unknown id", async () => {
    setRuntimeForTests(fixturesRuntime());
    expect((await call("nope")).status).toBe(404);
    expect((await call("sample-unknown-room")).status).toBe(404);
  });

  it("uses the model text when it is grounded", async () => {
    const generate = vi.fn(async () => ({ text: reply("live-slate"), usage: { inputTokens: 100, outputTokens: 50 } }));
    const settle = vi.fn(async () => undefined);
    setRuntimeForTests(fixturesRuntime({ explainModel: { generate }, explainBudget: () => async () => ({ settle }) }));
    const body = (await (await call("sample-leipzig-indie")).json()) as { explanation: { source: string } };
    expect(body.explanation.source).toBe("llm");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(150);
  });

  it("falls back to the template for an ungrounded reply, a thrown error and a spent budget", async () => {
    const ungrounded: ExplainModel = { generate: vi.fn(async () => ({ text: reply("ungrounded") })) };
    const throwing: ExplainModel = { generate: vi.fn(async () => Promise.reject(new Error("down"))) };
    const spent: ExplainModel = { generate: vi.fn(async () => ({ text: reply("live-slate") })) };
    for (const [model, budget] of [
      [ungrounded, async () => ({ settle: async () => undefined })],
      [throwing, async () => ({ settle: async () => undefined })],
      [spent, async () => null],
    ] as const) {
      setRuntimeForTests(fixturesRuntime({ explainModel: model, explainBudget: () => budget }));
      const body = (await (await call("sample-leipzig-indie")).json()) as { explanation: { source: string } };
      expect(body.explanation.source).toBe("template");
    }
    expect(spent.generate).not.toHaveBeenCalled();
  });
});

describe("explainModelFrom (adapter over the M3-01 provider)", () => {
  const turn = (content: string | null) => ({
    content,
    toolCalls: [],
    usage: { inputTokens: 500, outputTokens: 200, reasoningTokens: 0, cachedInputTokens: 0, totalTokens: 700 },
    costUsd: 0.0001,
    model: "gpt-5-nano",
    finishReason: "stop",
  });
  const req = { system: "S", user: "U", maxOutputTokens: 1500, json: true as const, signal: new AbortController().signal };

  it("makes one structured-output turn with the system and user messages and the token cap, and returns usage", async () => {
    const complete = vi.fn(async () => turn('{"sentences":["a"]}'));
    const out = await explainModelFrom({ model: "gpt-5-nano", complete }).generate(req);
    expect(complete).toHaveBeenCalledTimes(1);
    const arg = (complete.mock.calls[0] as unknown as [{ messages: unknown; maxCompletionTokens: number; jsonSchema: { name: string } }])[0];
    expect(arg.messages).toEqual([
      { role: "system", content: "S" },
      { role: "user", content: "U" },
    ]);
    expect(arg.maxCompletionTokens).toBe(1500);
    expect(arg.jsonSchema.name).toBe("explanation");
    expect(out).toEqual({ text: '{"sentences":["a"]}', usage: { inputTokens: 500, outputTokens: 200 }, costUsd: 0.0001 });
  });

  it("hands unusable content back as text, so explainSlate falls back to the template", async () => {
    const out = await explainModelFrom({ model: "m", complete: async () => turn("not json") }).generate(req);
    expect(out.text).toBe("not json");
  });

  it("a provider error propagates and the explanation uses the template", async () => {
    setRuntimeForTests(
      fixturesRuntime({
        explainModel: explainModelFrom({ model: "m", complete: async () => Promise.reject(new Error("llm_timeout")) }),
        explainBudget: () => async () => ({ settle: async () => undefined }),
      }),
    );
    const body = (await (await call("sample-leipzig-indie")).json()) as { explanation: { source: string } };
    expect(body.explanation.source).toBe("template");
  });
});

describe("llmBudgetFrom", () => {
  const settle = vi.fn(async () => undefined);
  const allow = (llm: "on" | "deterministic_only"): GuardDecision => ({ kind: "allow", qloo: "live", llm, settle });

  it("reserves through the guard with the llmTokens cost, and settles the real usage", async () => {
    const guard = vi.fn(async () => allow("on"));
    const lease = await llmBudgetFrom(guard, new Headers())(1800);
    expect(guard).toHaveBeenCalledWith(expect.any(Headers), { route: "explain", llmTokens: 1800 });
    await lease?.settle(900);
    expect(settle).toHaveBeenCalledWith({ llmTokens: 900 });
  });

  it("is null (template) when the guard denies or the LLM ceiling is reached", async () => {
    const deny: GuardDecision = { kind: "deny", reason: "ip_limit", retryAfterSeconds: 10 };
    expect(await llmBudgetFrom(async () => deny, new Headers())(10)).toBeNull();
    settle.mockClear();
    expect(await llmBudgetFrom(async () => allow("deterministic_only"), new Headers())(10)).toBeNull();
    expect(settle).toHaveBeenCalledWith({ llmTokens: 0 });
  });
});
