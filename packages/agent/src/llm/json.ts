import { z } from "zod";
import type { LlmMessage, LlmProvider, LlmTurn } from "./types";

export type JsonResult<T> =
  | { readonly ok: true; readonly value: T; readonly turn: LlmTurn }
  | { readonly ok: false; readonly reason: "empty" | "invalid_json" | "schema"; readonly turn: LlmTurn };

/** JSON Schema for a zod schema, in the shape OpenAI structured outputs accept (no `$schema` key). */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const out: Record<string, unknown> = { ...z.toJSONSchema(schema) };
  delete out["$schema"];
  return out;
}

/**
 * One model turn that must return JSON matching a zod schema (used by the explanation, M3-02).
 * The output is untrusted: it is parsed and validated here; the caller applies its own checks
 * (for example grounding) and falls back to a deterministic path on `ok: false`.
 */
export async function completeJson<S extends z.ZodType>(
  provider: LlmProvider,
  input: { readonly messages: readonly LlmMessage[]; readonly name: string; readonly schema: S; readonly maxCompletionTokens: number },
): Promise<JsonResult<z.output<S>>> {
  const turn = await provider.complete({
    messages: input.messages,
    maxCompletionTokens: input.maxCompletionTokens,
    jsonSchema: { name: input.name, schema: jsonSchemaOf(input.schema) },
  });
  if (!turn.content) return { ok: false, reason: "empty", turn };
  let raw: unknown;
  try {
    raw = JSON.parse(turn.content);
  } catch {
    return { ok: false, reason: "invalid_json", turn };
  }
  const parsed = input.schema.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data, turn } : { ok: false, reason: "schema", turn };
}
