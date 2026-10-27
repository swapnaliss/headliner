import { z } from "zod";
import { MAX_CANDIDATE_ACTS, MAX_CITIES, MAX_CROWD_ACTS, MAX_NAME_CHARS, MAX_QUESTION_CHARS } from "./guardrails";

/**
 * Intake output contract. Limits are the ADR 0003 / ticket caps: 6 crowd acts, 12 candidates,
 * 5 cities, names of at most 80 characters. Over-limit model output is REJECTED (and retried within the
 * step budget), never silently truncated, so the booker never sees a list the model did not produce.
 * The Room is a proposal: names still go through the match-confirmation screen (M2-01).
 */
const name = z
  .string()
  .refine((s) => !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(s), { message: "contains control characters" })
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "must not be empty").max(MAX_NAME_CHARS, `must be at most ${MAX_NAME_CHARS} characters`));

/** What the model submits through the `submit_room` tool. */
export const SubmitRoomSchema = z
  .object({
    city: name,
    crowdActs: z.array(name).max(MAX_CROWD_ACTS),
    candidateActs: z.array(name).max(MAX_CANDIDATE_ACTS),
    cities: z.array(name).max(MAX_CITIES),
  })
  .strict();
export type SubmitRoom = z.infer<typeof SubmitRoomSchema>;

export const MAX_INTAKE_STEPS = 3;

export const IntakeResultSchema = z
  .object({
    room: z
      .object({
        city: z.string().max(MAX_NAME_CHARS),
        crowdActs: z.array(name).max(MAX_CROWD_ACTS),
        candidateActs: z.array(name).max(MAX_CANDIDATE_ACTS),
      })
      .strict(),
    cities: z.array(name).max(MAX_CITIES),
    clarification: z.string().min(1).max(MAX_QUESTION_CHARS).optional(),
    steps: z.number().int().min(0).max(MAX_INTAKE_STEPS),
  })
  .strict()
  .refine((r) => r.clarification !== undefined || r.room.city.length > 0, { message: "city is required unless a question is asked", path: ["room", "city"] });
export type IntakeResult = z.infer<typeof IntakeResultSchema>;
