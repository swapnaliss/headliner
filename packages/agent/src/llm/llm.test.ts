import type OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { completeJson } from "./json";
import { createOpenAiProvider, defaultEffort, type UsageEvent } from "./openai";
import { costUsd, DEFAULT_LLM_MODEL, priceOf } from "./pricing";
import { createReplayProvider } from "./replay";
import { LlmError, ZERO_USAGE } from "./types";

type Create = (body: Record<string, unknown>, opts: unknown) => Promise<unknown>;
const fakeClient = (create: Create): Pick<OpenAI, "chat"> => ({ chat: { completions: { create } } }) as unknown as Pick<OpenAI, "chat">;

const REPLY = {
  choices: [{ finish_reason: "stop", message: { content: '{"a":1}', tool_calls: [{ id: "t1", type: "function", function: { name: "f", arguments: "{}" } }] } }],
  usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500, completion_tokens_details: { reasoning_tokens: 300 }, prompt_tokens_details: { cached_tokens: 200 } },
};

describe("pricing", () => {
  it("the default model is gpt-5-nano at $0.05 in and $0.40 out per 1M tokens", () => {
    expect(DEFAULT_LLM_MODEL).toBe("gpt-5-nano");
    expect(priceOf("gpt-5-nano")).toEqual({ input: 0.05, cachedInput: 0.005, output: 0.4 });
  });
  it("costs a call from usage, billing reasoning tokens as output and cached input at the cached rate", () => {
    const usage = { ...ZERO_USAGE, inputTokens: 1000, outputTokens: 500, cachedInputTokens: 200, totalTokens: 1500 };
    expect(costUsd("gpt-5-nano", usage)).toBeCloseTo((800 * 0.05 + 200 * 0.005 + 500 * 0.4) / 1e6, 12);
  });
  it("prices an unlisted model at the highest known rate", () => {
    expect(priceOf("something-new").output).toBe(2.0);
  });
});

describe("createOpenAiProvider", () => {
  it("sends max_completion_tokens and reasoning_effort, never temperature or top_p, and logs usage and cost", async () => {
    let body: Record<string, unknown> = {};
    const events: UsageEvent[] = [];
    const provider = createOpenAiProvider({
      apiKey: "unused",
      onUsage: (e) => events.push(e),
      client: fakeClient(async (b) => {
        body = b;
        return REPLY;
      }),
    });
    const turn = await provider.complete({
      messages: [{ role: "user", content: "hi" }],
      tools: [{ name: "f", description: "d", parameters: { type: "object" } }],
      toolChoice: "required",
      maxCompletionTokens: 700,
    });
    expect(body["model"]).toBe("gpt-5-nano");
    expect(body["max_completion_tokens"]).toBe(700);
    expect(body["reasoning_effort"]).toBe("minimal");
    expect(body["tool_choice"]).toBe("required");
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("top_p");
    expect(body).not.toHaveProperty("max_tokens");
    expect(turn.usage).toEqual({ inputTokens: 1000, outputTokens: 500, reasoningTokens: 300, cachedInputTokens: 200, totalTokens: 1500 });
    expect(turn.toolCalls).toEqual([{ id: "t1", name: "f", arguments: "{}" }]);
    expect(events).toHaveLength(1);
    expect(events[0]?.costUsd).toBeCloseTo(turn.costUsd, 12);
    expect(JSON.stringify(events)).not.toContain("hi");
  });

  it("honours LLM model override and structured output", async () => {
    let body: Record<string, unknown> = {};
    const provider = createOpenAiProvider({ apiKey: "unused", model: "gpt-6-luna", onUsage: () => undefined, client: fakeClient(async (b) => ((body = b), REPLY)) });
    await provider.complete({ messages: [], maxCompletionTokens: 10, jsonSchema: { name: "s", schema: { type: "object" } } });
    expect(body["model"]).toBe("gpt-6-luna");
    expect(body["response_format"]).toMatchObject({ type: "json_schema", json_schema: { name: "s", strict: true } });
    expect(body).not.toHaveProperty("tools");
  });

  it.each([
    [{ status: 429, message: "sk-SECRET quota" }, "unavailable"],
    [{ status: 400, message: "sk-SECRET bad" }, "rejected"],
    [Object.assign(new Error("sk-SECRET"), { name: "APIConnectionTimeoutError" }), "timeout"],
  ])("maps a provider failure to a fixed kind without its text", async (err, kind) => {
    const provider = createOpenAiProvider({ apiKey: "unused", client: fakeClient(async () => Promise.reject(err)) });
    const e = await provider.complete({ messages: [], maxCompletionTokens: 10 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(LlmError);
    expect((e as LlmError).kind).toBe(kind);
    expect(String((e as LlmError).message)).not.toContain("sk-SECRET");
  });
});

describe("defaultEffort", () => {
  it("picks the lowest effort each family accepts", () => {
    expect(defaultEffort("gpt-5-nano")).toBe("minimal");
    expect(defaultEffort("gpt-6-luna")).toBe("none");
    expect(defaultEffort("gpt-4o-mini")).toBeUndefined();
  });
});

describe("completeJson", () => {
  const schema = z.object({ a: z.number() }).strict();
  const provider = (content: string | null) =>
    createReplayProvider([{ content, toolCalls: [], usage: ZERO_USAGE, costUsd: 0, model: "m", finishReason: "stop" }]);
  const run = (content: string | null) => completeJson(provider(content), { messages: [], name: "x", schema, maxCompletionTokens: 10 });

  it("validates output with the zod schema", async () => {
    expect(await run('{"a":1}')).toMatchObject({ ok: true, value: { a: 1 } });
    expect(await run('{"a":"1"}')).toMatchObject({ ok: false, reason: "schema" });
    expect(await run("not json")).toMatchObject({ ok: false, reason: "invalid_json" });
    expect(await run(null)).toMatchObject({ ok: false, reason: "empty" });
  });
});

describe("createReplayProvider", () => {
  it("throws no_recording once the turns run out", async () => {
    const p = createReplayProvider([]);
    await expect(p.complete({ messages: [], maxCompletionTokens: 1 })).rejects.toMatchObject({ kind: "no_recording" });
  });
});
