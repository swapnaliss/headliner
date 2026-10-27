import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { createReplayProvider, type LlmProvider, type LlmTurn } from "../llm";
import { sanitizeInput } from "./guardrails";

const usage = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  reasoningTokens: z.number(),
  cachedInputTokens: z.number(),
  totalTokens: z.number(),
});

/** One recorded intake trace: the sentence, the model turns as returned, and the final outcome. */
export const TraceSchema = z.object({
  input: z.string(),
  clarified: z.boolean(),
  model: z.string(),
  recordedAt: z.string(),
  turns: z.array(
    z.object({
      content: z.string().nullable(),
      toolCalls: z.array(z.object({ id: z.string(), name: z.string(), arguments: z.string() })),
      usage,
      costUsd: z.number(),
      model: z.string(),
      finishReason: z.string(),
    }),
  ),
  outcome: z.object({ status: z.string() }).passthrough(),
});
export type IntakeTrace = z.infer<typeof TraceSchema>;

const keyOf = (text: string, clarified: boolean): string => `${clarified ? "c" : "n"}|${text}`;

export interface IntakeReplay {
  readonly size: number;
  /** A provider that replays the trace for this sentence; with no trace it has no turns (`no_recording`). */
  providerFor(input: unknown, clarified: boolean): LlmProvider;
}

export function loadIntakeTraces(dir: string): IntakeTrace[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => TraceSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))));
}

/** DEMO_MODE=fixtures: replays `fixtures/agent/intake/*.json`. No key, no network. */
export function createIntakeReplay(traces: readonly IntakeTrace[]): IntakeReplay {
  const byKey = new Map<string, IntakeTrace>();
  for (const t of traces) {
    const s = sanitizeInput(t.input);
    if (s.ok) byKey.set(keyOf(s.text, t.clarified), t);
  }
  return {
    size: byKey.size,
    providerFor(input, clarified) {
      const s = sanitizeInput(input);
      const trace = s.ok ? byKey.get(keyOf(s.text, clarified)) : undefined;
      return createReplayProvider((trace?.turns ?? []) as LlmTurn[], "recorded");
    },
  };
}
