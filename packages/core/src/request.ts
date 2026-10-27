import { z } from "zod";

/**
 * The create-slate request (ADR 0003 limits): max 12 candidates, 6 crowd acts, name length 80.
 * Shared by the route handler and the UI. Names are UTF-8 text; control characters, line and
 * paragraph separators are rejected so a name can never smuggle structure into a log line, a
 * header or an upstream request.
 */
export const MAX_NAME_LENGTH = 80;
export const MIN_CROWD_ACTS = 3;
export const MAX_CROWD_ACTS = 6;
export const MIN_CANDIDATE_ACTS = 3;
export const MAX_CANDIDATE_ACTS = 12;

const FORBIDDEN = /[\p{Cc}\p{Zl}\p{Zp}]/u;

const text = z
  .string()
  .refine((s) => !FORBIDDEN.test(s), { message: "contains control characters" })
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "must not be empty").max(MAX_NAME_LENGTH, `must be at most ${MAX_NAME_LENGTH} characters`));

export const CreateSlateRequestSchema = z
  .object({
    city: text,
    crowdActs: z.array(text).min(MIN_CROWD_ACTS).max(MAX_CROWD_ACTS),
    candidateActs: z.array(text).min(MIN_CANDIDATE_ACTS).max(MAX_CANDIDATE_ACTS),
  })
  .strict();
export type CreateSlateRequest = z.infer<typeof CreateSlateRequestSchema>;

/** Lazy city strength (ADR 0004): at most 5 heatmap calls per act, so at most 5 cities per request. */
export const MAX_CITIES_PER_REQUEST = 5;

export const CityStrengthRequestSchema = z.object({ cities: z.array(text).min(1).max(MAX_CITIES_PER_REQUEST) }).strict();
export type CityStrengthRequest = z.infer<typeof CityStrengthRequestSchema>;
