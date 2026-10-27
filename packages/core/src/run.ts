import { z } from "zod";
import { EvidenceSchema } from "./types";
import { CreateSlateRequestSchema, MAX_CANDIDATE_ACTS, MAX_CROWD_ACTS, MAX_NAME_LENGTH } from "./request";

/**
 * A run waiting for the user to confirm entity matches (state machine: matching ->
 * awaiting_confirmation -> scoring). Stored server-side so a confirm request can only choose
 * from the candidates the server itself returned. Every string from Qloo is untrusted text.
 */

/** `not-in-recordings`: fixtures mode has no recorded search for the name. `search-failed`: live search errored. */
export const MATCH_ROW_STATES = ["exact", "ambiguous", "none", "not-in-recordings", "search-failed"] as const;
export type MatchRowState = (typeof MATCH_ROW_STATES)[number];

export const MatchCandidateSchema = z.object({
  entityId: z.string().min(1).max(64),
  name: z.string(),
  popularity: z.number().min(0).max(1).nullable(),
  tags: z.array(z.string()).max(3),
  disambiguation: z.string().nullable(),
});

export const MatchRowSchema = z.object({
  role: z.enum(["crowd", "candidate"]),
  /** The name as typed (trimmed). */
  actInput: z.string().min(1).max(MAX_NAME_LENGTH),
  state: z.enum(MATCH_ROW_STATES),
  /** Up to 5. `exact` has one; `none` and the error states have none. */
  candidates: z.array(MatchCandidateSchema).max(5),
  /** The Qloo search call behind this row (redacted). Null when the call failed. */
  evidence: EvidenceSchema.nullable(),
});
export type MatchRow = z.infer<typeof MatchRowSchema>;

export const RunSchema = z.object({
  id: z.string().min(1),
  request: CreateSlateRequestSchema,
  matches: z.array(MatchRowSchema).min(1),
  createdAt: z.string().min(1),
  /** True when any search came from an expired cache entry. */
  stale: z.boolean(),
});
export type Run = z.infer<typeof RunSchema>;

/** The confirm body: one choice per distinct typed name that needs a decision. */
export const ChoiceSchema = z
  .object({
    actInput: z.string().min(1).max(MAX_NAME_LENGTH),
    entityId: z.union([z.literal("skip"), z.string().regex(/^[A-Za-z0-9-]{1,64}$/)]),
  })
  .strict();
export type Choice = z.infer<typeof ChoiceSchema>;

export const ConfirmRequestSchema = z
  .object({ choices: z.array(ChoiceSchema).max(MAX_CROWD_ACTS + MAX_CANDIDATE_ACTS) })
  .strict();
export type ConfirmRequest = z.infer<typeof ConfirmRequestSchema>;
