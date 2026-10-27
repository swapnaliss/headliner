import { completeJson, type ExplainModel, type LlmProvider } from "@headliner/agent";
import { z } from "zod";

/**
 * The structured-output shape asked of the model. Deliberately loose (no length limits): strict
 * structured outputs accept only a subset of JSON Schema. The real limits (at most 12 sentences,
 * 320 characters each, no extra keys) are enforced by `explainSlate` on the reply, and every figure
 * by `groundingCheck`.
 */
const RequestSchema = z.object({ sentences: z.array(z.string()) });

/**
 * Adapts the M3-01 provider (`packages/agent/src/llm`) to the explanation's `ExplainModel` port: one
 * `completeJson` turn. No second OpenAI client is created. The provider owns the timeout, the
 * reasoning effort and the cost log; `usage` (input + output, reasoning billed as output) goes back
 * so the budget lease is settled with the real figure. Anything unusable comes back as text that
 * `explainSlate` rejects, so the page falls back to the template.
 */
export function explainModelFrom(provider: LlmProvider): ExplainModel {
  return {
    model: provider.model,
    async generate({ system, user, maxOutputTokens }) {
      const result = await completeJson(provider, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        name: "explanation",
        schema: RequestSchema,
        maxCompletionTokens: maxOutputTokens,
      });
      const usage = { inputTokens: result.turn.usage.inputTokens, outputTokens: result.turn.usage.outputTokens };
      return { text: result.ok ? JSON.stringify(result.value) : (result.turn.content ?? ""), usage, costUsd: result.turn.costUsd };
    },
  };
}
