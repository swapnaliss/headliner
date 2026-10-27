import type { QlooClient } from "@headliner/qloo";
import { estimateTokens, LlmError, RunMeter, type LlmBudget, type LlmMessage, type LlmProvider, type LlmToolCall } from "../llm";
import { cleanThirdPartyText, dedupeNames, findUngrounded, MAX_QUESTION_CHARS, sanitizeInput, type InputRejection } from "./guardrails";
import { initialMessages, NUDGE } from "./prompt";
import { IntakeResultSchema, MAX_INTAKE_STEPS, SubmitRoomSchema, type IntakeResult } from "./schema";
import {
  ClarifyArgsSchema,
  MAX_PROPOSE_CALLS,
  proposeMatches,
  ProposeArgsSchema,
  toolDefs,
  toolResultText,
  TOOL_CLARIFY,
  TOOL_PROPOSE,
  TOOL_SUBMIT,
} from "./tools";

export { MAX_INTAKE_STEPS };

/** Per-turn cap on generated tokens, reasoning included (reasoning tokens are billed as output). */
export const TURN_MAX_COMPLETION_TOKENS = 1_500;
/** Per-run ceilings (docs/architecture.md section 7). At worst 9,000 tokens is about 0.004 USD on gpt-5-nano. */
export const MAX_RUN_TOKENS = 9_000;
export const MAX_RUN_COST_USD = 0.01;

/**
 * Fixed question used when the model submits a room with no city, or with no artist at all, while a
 * clarification is still allowed. A small model sometimes submits an empty room instead of asking;
 * code turns that into the one allowed question, so an under-specified sentence always gets exactly one.
 */
export const FALLBACK_QUESTION = "Which city is the venue in, and which artists does your regular crowd already follow?";

export interface IntakeDeps {
  /** Absent means no model is available (no key): the result is deterministic. */
  readonly provider?: LlmProvider;
  /** Read-only Qloo adapter (through its cache). The only network the loop can reach. */
  readonly qloo: QlooClient;
  /** App-side budget (M2-05). Asked before every model turn. */
  readonly budget?: LlmBudget;
  /** True when the booker already answered a clarifying question: a second question is refused. */
  readonly clarified?: boolean;
  /** `recorded` when the provider replays a trace (fixtures mode). */
  readonly source?: "model" | "recorded";
  /** Test seam for the per-run ceilings. */
  readonly limits?: { readonly maxTokens?: number; readonly maxCostUsd?: number };
}

export interface RunUsage {
  readonly turns: number;
  readonly tokens: number;
  readonly costUsd: number;
}

export type DeterministicReason = "llm_unavailable" | "budget" | "run_ceiling" | "llm_error" | "no_recording";
export type FailureReason = "step_limit" | "invalid_output";

export type IntakeOutcome =
  | ({ readonly status: "room"; readonly mode: "agent"; readonly source: "model" | "recorded"; readonly usage: RunUsage } & IntakeResult)
  | ({ readonly status: "clarification"; readonly mode: "agent"; readonly source: "model" | "recorded"; readonly usage: RunUsage } & IntakeResult)
  | { readonly status: "deterministic"; readonly mode: "deterministic"; readonly reason: DeterministicReason; readonly steps: number; readonly usage: RunUsage }
  | { readonly status: "intake_failed"; readonly mode: "agent"; readonly reason: FailureReason; readonly steps: number; readonly usage: RunUsage }
  | { readonly status: "rejected"; readonly reason: InputRejection };

function parseArgs(call: LlmToolCall): unknown {
  try {
    return JSON.parse(call.arguments);
  } catch {
    return undefined;
  }
}

/** Schema paths only, so a tool error never echoes model or user text back into the prompt. */
function problems(error: { readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly code: string }[] }): string {
  return error.issues
    .slice(0, 6)
    .map((i) => `${i.path.map(String).join(".") || "arguments"}: ${i.code}`)
    .join("; ");
}

/**
 * Bounded intake loop (ADR 0009): at most `MAX_INTAKE_STEPS` model turns. Each turn the model may call
 * read-only tools (`propose_matches`, one `ask_clarification`) and finishes with `submit_room`.
 * Guardrails run before any model call; budgets are asked before every turn; any ceiling or provider
 * failure returns `mode: "deterministic"` so the form stays usable. The model never produces a number
 * that is shown as a score; the room is a proposal that still goes through match confirmation.
 */
export async function runIntake(input: unknown, deps: IntakeDeps): Promise<IntakeOutcome> {
  const sanitized = sanitizeInput(input);
  if (!sanitized.ok) return { status: "rejected", reason: sanitized.reason };

  const meter = new RunMeter(deps.limits?.maxTokens ?? MAX_RUN_TOKENS, deps.limits?.maxCostUsd ?? MAX_RUN_COST_USD);
  const usage = (): RunUsage => ({ turns: meter.totals.turns, tokens: meter.totals.tokens, costUsd: meter.totals.costUsd });
  const deterministic = (reason: DeterministicReason, steps: number): IntakeOutcome => ({ status: "deterministic", mode: "deterministic", reason, steps, usage: usage() });
  const source = deps.source ?? "model";

  if (!deps.provider) return deterministic("llm_unavailable", 0);

  let clarificationAllowed = deps.clarified !== true;
  const messages: LlmMessage[] = initialMessages(sanitized.text, deps.clarified === true);
  let proposeCalls = 0;
  let steps = 0;
  let lastInvalid = false;

  while (steps < MAX_INTAKE_STEPS) {
    const reserve = Math.min(
      TURN_MAX_COMPLETION_TOKENS + estimateTokens(messages.map((m) => ("content" in m ? (m.content ?? "") : "")).join("\n")),
      meter.maxTokens,
    );
    if (!meter.canAfford(reserve)) return deterministic("run_ceiling", steps);
    const grant = deps.budget ? await deps.budget.reserve(reserve) : undefined;
    if (deps.budget && grant === null) return deterministic("budget", steps);

    let turn;
    try {
      turn = await deps.provider.complete({ messages, tools: toolDefs(clarificationAllowed, steps === MAX_INTAKE_STEPS - 1), toolChoice: "required", maxCompletionTokens: TURN_MAX_COMPLETION_TOKENS });
    } catch (e) {
      await grant?.settle(0);
      return deterministic(e instanceof LlmError && e.kind === "no_recording" ? "no_recording" : "llm_error", steps);
    }
    steps += 1;
    meter.record(turn);
    await grant?.settle(turn.usage.totalTokens);
    messages.push({ role: "assistant", content: turn.content, toolCalls: turn.toolCalls });

    if (turn.toolCalls.length === 0) {
      lastInvalid = true;
      messages.push({ role: "user", content: NUDGE });
      continue;
    }

    // A question ends the run: the booker answers and sends the sentence again with `clarified`.
    const ask = turn.toolCalls.find((c) => c.name === TOOL_CLARIFY);
    if (ask && clarificationAllowed) {
      const args = ClarifyArgsSchema.safeParse(parseArgs(ask));
      if (args.success) {
        const question = cleanThirdPartyText(args.data.question, MAX_QUESTION_CHARS);
        if (question.length > 0) {
          const result = IntakeResultSchema.parse({ room: { city: "", crowdActs: [], candidateActs: [] }, cities: [], clarification: question, steps });
          return { status: "clarification", mode: "agent", source, usage: usage(), ...result };
        }
      }
    }

    for (const call of turn.toolCalls) {
      let reply: string;
      if (call.name === TOOL_PROPOSE) {
        const args = ProposeArgsSchema.safeParse(parseArgs(call));
        if (!args.success) reply = JSON.stringify({ error: "invalid_arguments" });
        else if (proposeCalls >= MAX_PROPOSE_CALLS) reply = toolResultText({ status: "limit_reached", matches: [] });
        else {
          proposeCalls += 1;
          reply = toolResultText(await proposeMatches(deps.qloo, args.data.name));
        }
      } else if (call.name === TOOL_CLARIFY) {
        reply = JSON.stringify({ error: "clarification_not_allowed", note: "Proceed with the best room you can from the sentence." });
        clarificationAllowed = false;
      } else if (call.name === TOOL_SUBMIT) {
        const rawArgs = parseArgs(call);
        const parsed = SubmitRoomSchema.safeParse(rawArgs);
        const empty =
          parsed.success
            ? parsed.data.crowdActs.length === 0 && parsed.data.candidateActs.length === 0
            : typeof rawArgs === "object" && rawArgs !== null && (rawArgs as { city?: unknown }).city === "";
        if (clarificationAllowed && (empty || (parsed.success && parsed.data.city.length === 0))) {
          const result = IntakeResultSchema.parse({ room: { city: "", crowdActs: [], candidateActs: [] }, cities: [], clarification: FALLBACK_QUESTION, steps });
          return { status: "clarification", mode: "agent", source, usage: usage(), ...result };
        }
        let ungrounded: string[] = [];
        if (parsed.success) {
          const room = parsed.data;
          ungrounded = findUngrounded(sanitized.text, room);
          if (ungrounded.length === 0) {
            const crowd = dedupeNames(room.crowdActs);
            const inCrowd = new Set(crowd.map((n) => n.toLowerCase()));
            const result = IntakeResultSchema.safeParse({
              room: { city: room.city, crowdActs: crowd, candidateActs: dedupeNames(room.candidateActs).filter((n) => !inCrowd.has(n.toLowerCase())) },
              cities: dedupeNames(room.cities),
              steps,
            });
            if (result.success) return { status: "room", mode: "agent", source, usage: usage(), ...result.data };
          }
        }
        lastInvalid = true;
        reply = JSON.stringify({
          error: "invalid_room",
          problems: parsed.success ? `not in the sentence: ${ungrounded.join(", ") || "result"}` : problems(parsed.error),
        });
      } else {
        reply = JSON.stringify({ error: "unknown_tool" });
      }
      messages.push({ role: "tool", toolCallId: call.id, content: reply });
    }
  }

  return { status: "intake_failed", mode: "agent", reason: lastInvalid ? "invalid_output" : "step_limit", steps, usage: usage() };
}
