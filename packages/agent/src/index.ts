export const version = "0.1.0";

export * from "./llm";
export {
  cleanThirdPartyText,
  dedupeNames,
  MAX_CANDIDATE_ACTS,
  MAX_CITIES,
  MAX_CROWD_ACTS,
  MAX_INPUT_CHARS,
  MAX_NAME_CHARS,
  sanitizeInput,
} from "./intake/guardrails";
export type { InputRejection, SanitizedInput } from "./intake/guardrails";
export { FALLBACK_QUESTION, MAX_INTAKE_STEPS, MAX_RUN_COST_USD, MAX_RUN_TOKENS, runIntake, TURN_MAX_COMPLETION_TOKENS } from "./intake/loop";
export type { DeterministicReason, FailureReason, IntakeDeps, IntakeOutcome, RunUsage } from "./intake/loop";
export { IntakeResultSchema, SubmitRoomSchema } from "./intake/schema";
export type { IntakeResult, SubmitRoom } from "./intake/schema";
export { createIntakeReplay, loadIntakeTraces, TraceSchema } from "./intake/replay";
export type { IntakeReplay, IntakeTrace } from "./intake/replay";
export { MAX_PROPOSE_CALLS } from "./intake/tools";
export * from "./explain/index";
