import OpenAI from "openai";
import { costUsd, DEFAULT_LLM_MODEL } from "./pricing";
import { LlmError, type LlmMessage, type LlmProvider, type LlmRequest, type LlmTurn, type LlmUsage } from "./types";

export interface UsageEvent {
  readonly event: "llm_usage";
  readonly model: string;
  readonly usage: LlmUsage;
  readonly costUsd: number;
}

export interface OpenAiProviderOptions {
  readonly apiKey: string;
  /** Defaults to `DEFAULT_LLM_MODEL`. */
  readonly model?: string;
  /** Per-call timeout. Every outbound call has one (engineering standards section 4). Default 20 s. */
  readonly timeoutMs?: number;
  /**
   * Reasoning models reject `temperature` and `top_p`, so neither is ever sent. Effort is kept low:
   * the task is extraction, and reasoning tokens are billed as output.
   */
  readonly reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  /** Called once per successful call with usage and cost (no content, no key). Default: one JSON log line. */
  readonly onUsage?: (event: UsageEvent) => void;
  /** Test seam. */
  readonly client?: Pick<OpenAI, "chat">;
}

/**
 * Lowest reasoning effort each model family accepts (OpenAI model pages, 2026-10-27): gpt-5 family
 * `minimal`; gpt-6 family `none` (it rejects `minimal`, and its Chat Completions tool calling needs `none`);
 * gpt-4 family are not reasoning models and take no effort parameter.
 */
export function defaultEffort(model: string): OpenAiProviderOptions["reasoningEffort"] {
  if (model.startsWith("gpt-4")) return undefined;
  if (model.startsWith("gpt-6")) return "none";
  return "minimal";
}

function defaultSink(e: UsageEvent): void {
  console.info(
    JSON.stringify({
      level: "info",
      event: e.event,
      model: e.model,
      in: e.usage.inputTokens,
      out: e.usage.outputTokens,
      reasoning: e.usage.reasoningTokens,
      costUsd: Number(e.costUsd.toFixed(6)),
    }),
  );
}

function toOpenAiMessages(messages: readonly LlmMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
    switch (m.role) {
      case "system":
        return { role: "system", content: m.content };
      case "user":
        return { role: "user", content: m.content };
      case "tool":
        return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
      case "assistant":
        return {
          role: "assistant",
          content: m.content,
          ...(m.toolCalls && m.toolCalls.length > 0
            ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.arguments } })) }
            : {}),
        };
    }
  });
}

/** The only file that knows about OpenAI. Maps every SDK failure to a fixed `LlmError` kind. */
export function createOpenAiProvider(options: OpenAiProviderOptions): LlmProvider {
  const model = options.model ?? DEFAULT_LLM_MODEL;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const effort = options.reasoningEffort ?? defaultEffort(model);
  const sink = options.onUsage ?? defaultSink;
  const client = options.client ?? new OpenAI({ apiKey: options.apiKey, maxRetries: 0, timeout: timeoutMs });

  return {
    model,
    async complete(request: LlmRequest): Promise<LlmTurn> {
      let response: OpenAI.Chat.Completions.ChatCompletion;
      try {
        response = await client.chat.completions.create(
          {
            model,
            messages: toOpenAiMessages(request.messages),
            max_completion_tokens: request.maxCompletionTokens,
            ...(effort ? { reasoning_effort: effort } : {}),
            ...(request.tools && request.tools.length > 0
              ? {
                  tool_choice: request.toolChoice ?? ("auto" as const),
                  tools: request.tools.map((t) => ({
                    type: "function" as const,
                    function: { name: t.name, description: t.description, parameters: { ...t.parameters } },
                  })),
                }
              : {}),
            ...(request.jsonSchema && !request.tools
              ? {
                  response_format: {
                    type: "json_schema" as const,
                    json_schema: { name: request.jsonSchema.name, strict: true, schema: { ...request.jsonSchema.schema } },
                  },
                }
              : {}),
          },
          { timeout: timeoutMs, signal: AbortSignal.timeout(timeoutMs + 1_000) },
        );
      } catch (e) {
        const status = typeof e === "object" && e !== null && "status" in e ? (e as { status?: unknown }).status : undefined;
        const name = e instanceof Error ? e.name : "";
        if (name.includes("Timeout") || name === "AbortError") throw new LlmError("timeout");
        if (status === 400 || status === 404 || status === 422) throw new LlmError("rejected");
        throw new LlmError("unavailable");
      }

      const choice = response.choices[0];
      if (!choice) throw new LlmError("unavailable");
      const u = response.usage;
      const usage: LlmUsage = {
        inputTokens: u?.prompt_tokens ?? 0,
        outputTokens: u?.completion_tokens ?? 0,
        reasoningTokens: u?.completion_tokens_details?.reasoning_tokens ?? 0,
        cachedInputTokens: u?.prompt_tokens_details?.cached_tokens ?? 0,
        totalTokens: u?.total_tokens ?? 0,
      };
      const cost = costUsd(model, usage);
      try {
        sink({ event: "llm_usage", model, usage, costUsd: cost });
      } catch {
        // an observer must never break a call
      }
      const toolCalls = (choice.message.tool_calls ?? []).flatMap((c) =>
        c.type === "function" ? [{ id: c.id, name: c.function.name, arguments: c.function.arguments }] : [],
      );
      return { content: choice.message.content ?? null, toolCalls, usage, costUsd: cost, model, finishReason: choice.finish_reason };
    },
  };
}
