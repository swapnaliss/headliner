import { z } from "zod";

/**
 * Shared shapes (docs/architecture.md section 2), reused by the route handlers and the UI.
 * Every number on an ActResult carries `evidenceRefs` that point at `ActResult.evidence[].id`.
 */

/** A redacted request summary for one Qloo call. The API key is never part of it. */
export const EvidenceSchema = z.object({
  /** Stable reference used by `evidenceRefs`. */
  id: z.string().min(1),
  endpoint: z.string().min(1),
  /** Typed request params with secrets removed. */
  redactedParams: z.record(z.string(), z.string()),
  responseDigest: z.string().min(1),
  /** ISO 8601 timestamp supplied by the caller (core never reads the clock). */
  fetchedAt: z.string().min(1),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const CAVEAT_TYPES = [
  "thin-data",
  "no-data",
  "low-match-confidence",
  "standing-unavailable",
  "single-tag-overlap",
] as const;
export const CaveatTypeSchema = z.enum(CAVEAT_TYPES);
export type CaveatType = z.infer<typeof CaveatTypeSchema>;

export const CaveatSchema = z.object({
  type: CaveatTypeSchema,
  /** Fixed wording from caveats.ts. */
  message: z.string().min(1),
  /** What the caveat is about (a city string), when it is about one thing. Untrusted text: render plain. */
  subject: z.string().optional(),
});
export type Caveat = z.infer<typeof CaveatSchema>;

export const ActSchema = z.object({
  qlooEntityId: z.string().min(1),
  name: z.string().min(1),
  /** 0..1 confidence of the name-to-entity match. */
  matchConfidence: z.number().min(0).max(1),
});
export type Act = z.infer<typeof ActSchema>;

export const RoomSchema = z.object({
  city: z.string().min(1),
  crowdActs: z.array(ActSchema).min(1),
});
export type Room = z.infer<typeof RoomSchema>;

const EvidenceRefs = z.array(z.string().min(1));

export const OverlapTagSchema = z.object({
  tagId: z.string().min(1),
  name: z.string().min(1),
  score: z.number().min(0).max(1),
});

export const FitValueSchema = z.object({
  /** Audience-taste fit, 0..100, one decimal. */
  value: z.number().min(0).max(100),
  sharedTags: z.number().int().min(1),
  evidenceRefs: EvidenceRefs,
});

export const StandingValueSchema = z.object({
  caption: z.literal("Qloo popularity rank"),
  candidatePercentile: z.number().min(0).max(100),
  crowdMedianPercentile: z.number().min(0).max(100),
  crowdSample: z.number().int().min(1),
  deltaPoints: z.number().min(-100).max(100),
  label: z.enum(["above", "similar", "below"]),
  evidenceRefs: EvidenceRefs,
});

export const CityStrengthValueSchema = z.object({
  city: z.string().min(1),
  meanAffinityRank: z.number().min(0).max(1),
  cellCount: z.number().int().min(1),
  thinData: z.boolean(),
  evidenceRefs: EvidenceRefs,
});

export const ActResultSchema = z.object({
  act: ActSchema,
  /** `no-data` acts have no fit and sort last. */
  status: z.enum(["scored", "no-data"]),
  /** 1-based position among scored acts; null for `no-data`. */
  rank: z.number().int().min(1).nullable(),
  fit: FitValueSchema.nullable(),
  overlapTags: z.array(OverlapTagSchema),
  standing: StandingValueSchema.nullable(),
  cityStrengths: z.array(CityStrengthValueSchema),
  caveats: z.array(CaveatSchema),
  evidence: z.array(EvidenceSchema),
});
export type ActResult = z.infer<typeof ActResultSchema>;

export const SlateSchema = z.object({
  id: z.string().min(1),
  room: RoomSchema,
  results: z.array(ActResultSchema),
  /** ISO 8601 timestamp supplied by the caller. */
  createdAt: z.string().min(1),
});
export type Slate = z.infer<typeof SlateSchema>;
