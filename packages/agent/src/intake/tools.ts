import type { QlooClient } from "@headliner/qloo";
import { z } from "zod";
import { jsonSchemaOf, type LlmToolDef } from "../llm";
import { cleanThirdPartyText, MAX_NAME_CHARS, MAX_QUESTION_CHARS } from "./guardrails";
import { SubmitRoomSchema } from "./schema";

export const TOOL_PROPOSE = "propose_matches";
export const TOOL_CLARIFY = "ask_clarification";
export const TOOL_SUBMIT = "submit_room";

/** Upper bound on propose_matches calls in one run (6 crowd + 12 candidates): also the Qloo call budget to reserve. */
export const MAX_PROPOSE_CALLS = 18;
const MAX_MATCHES = 3;

export const ProposeArgsSchema = z.object({ name: z.string().min(1).max(MAX_NAME_CHARS) }).strict();
export const ClarifyArgsSchema = z.object({ question: z.string().min(1).max(MAX_QUESTION_CHARS) }).strict();

export function toolDefs(clarificationAllowed: boolean, submitOnly = false): LlmToolDef[] {
  const submit: LlmToolDef = { name: TOOL_SUBMIT, description: "Submit the final room proposal. Call exactly once.", parameters: jsonSchemaOf(SubmitRoomSchema) };
  if (submitOnly) return [submit];
  const defs: LlmToolDef[] = [
    {
      name: TOOL_PROPOSE,
      description: "Look up one artist name in Qloo. Returns up to 3 candidate matches with entity_id, name and popularity only.",
      parameters: jsonSchemaOf(ProposeArgsSchema),
    },
  ];
  if (clarificationAllowed) {
    defs.push({
      name: TOOL_CLARIFY,
      description: "Ask the booker one short clarifying question. Allowed once.",
      parameters: jsonSchemaOf(ClarifyArgsSchema),
    });
  }
  defs.push(submit);
  return defs;
}

/** The only shape a tool result may take: entity_id, name, popularity. No header, key or upstream error text. */
export interface ProposedMatch {
  readonly entity_id: string;
  readonly name: string;
  readonly popularity: number;
}

export type ProposeOutcome =
  | { readonly status: "ok"; readonly matches: readonly ProposedMatch[] }
  | { readonly status: "lookup_unavailable" | "limit_reached"; readonly matches: readonly [] };

/** Read-only: one Qloo `/search` through the adapter and its cache. Every failure becomes a fixed status. */
export async function proposeMatches(client: QlooClient, name: string): Promise<ProposeOutcome> {
  try {
    const result = await client.search(name, "artist");
    const matches = result.data.slice(0, MAX_MATCHES).map((e) => ({
      entity_id: e.entityId,
      name: cleanThirdPartyText(e.name),
      popularity: e.popularity,
    }));
    return { status: "ok", matches };
  } catch {
    return { status: "lookup_unavailable", matches: [] };
  }
}

export function toolResultText(outcome: ProposeOutcome): string {
  return JSON.stringify(outcome);
}
