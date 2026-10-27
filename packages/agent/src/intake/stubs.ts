import { createQlooClient, InMemoryCacheStore, type QlooClient, type QlooTransport } from "@headliner/qloo";
import { ZERO_USAGE, type LlmBudget, type LlmProvider, type LlmRequest, type LlmToolCall, type LlmTurn } from "../llm";

/** Test doubles shared by the intake tests. Not exported from the package. */

export function turnOf(calls: readonly LlmToolCall[], tokens = 100): LlmTurn {
  return {
    content: null,
    toolCalls: calls,
    usage: { ...ZERO_USAGE, inputTokens: tokens / 2, outputTokens: tokens / 2, totalTokens: tokens },
    costUsd: tokens * 0.0000004,
    model: "stub",
    finishReason: "tool_calls",
  };
}

export const call = (name: string, args: unknown, id = `c-${name}`): LlmToolCall => ({ id, name, arguments: JSON.stringify(args) });

export interface ScriptedProvider extends LlmProvider {
  readonly requests: LlmRequest[];
}

/** Returns the scripted turns in order; once exhausted it repeats the last one (a model that never stops). */
export function scripted(turns: readonly LlmTurn[]): ScriptedProvider {
  const requests: LlmRequest[] = [];
  return {
    model: "stub",
    requests,
    async complete(req) {
      requests.push(req);
      const turn = turns[Math.min(requests.length - 1, turns.length - 1)];
      if (!turn) throw new Error("empty script");
      return turn;
    },
  };
}

export function transportWith(handler: (endpoint: string, params: URLSearchParams) => { status: number; body: unknown } | Error): QlooTransport {
  return {
    async get(req) {
      const out = handler(req.endpoint, req.params);
      if (out instanceof Error) throw out;
      return out;
    },
  };
}

export const SEARCH_BODY = {
  results: [
    { entity_id: "E-KHRU", name: "Khruangbin", popularity: 0.61, types: ["urn:entity:artist"], extra_secret_field: "do-not-forward", tags: [] },
    { entity_id: "E-KHRU2", name: "Khruangbin\u0007 Tribute", popularity: 0.01, types: ["urn:entity:artist"] },
  ],
};

export function qlooStub(handler?: Parameters<typeof transportWith>[0]): QlooClient {
  return createQlooClient({
    transport: transportWith(handler ?? (() => ({ status: 200, body: SEARCH_BODY }))),
    cache: new InMemoryCacheStore(),
    sleep: async () => undefined,
    jitterMs: () => 0,
  });
}

export function budgetStub(allow: number): LlmBudget & { reserved: number[]; settled: number[] } {
  const reserved: number[] = [];
  const settled: number[] = [];
  return {
    reserved,
    settled,
    async reserve(max) {
      if (reserved.length >= allow) return null;
      reserved.push(max);
      return { settle: async (t) => void settled.push(t) };
    },
  };
}
