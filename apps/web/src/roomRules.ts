import { MAX_CANDIDATE_ACTS, MAX_CROWD_ACTS, MAX_NAME_LENGTH, MIN_CANDIDATE_ACTS, MIN_CROWD_ACTS } from "@headliner/core";

/** Client-side limits mirror the shared zod request schema (packages/core/src/request.ts); the server re-validates. */
export type ListKind = "crowd" | "candidate";

export const LIMITS = {
  crowd: { min: MIN_CROWD_ACTS, max: MAX_CROWD_ACTS, noun: "crowd" },
  candidate: { min: MIN_CANDIDATE_ACTS, max: MAX_CANDIDATE_ACTS, noun: "candidate" },
} as const;

const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]/u;

export function normalise(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Split a pasted list at commas and line breaks; blanks dropped. */
export function splitNames(raw: string): string[] {
  return raw
    .split(/[,\n\r]+/)
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}

export interface AddOutcome {
  list: string[];
  added: string[];
  /** The first problem, as the screen's error copy; null when something was added cleanly. */
  error: string | null;
  skipped: number;
}

/** Try to add typed or pasted names to one list, enforcing the same rules as the shared schema. */
export function addNames(kind: ListKind, list: readonly string[], other: readonly string[], raw: string): AddOutcome {
  const names = splitNames(raw);
  const { max } = LIMITS[kind];
  if (names.length === 0) return { list: [...list], added: [], error: "Type an artist name first.", skipped: 0 };
  const next = [...list];
  const added: string[] = [];
  let error: string | null = null;
  let skipped = 0;
  for (const name of names) {
    if (name.length > MAX_NAME_LENGTH) {
      error ??= `Artist names are limited to ${MAX_NAME_LENGTH} characters.`;
      skipped++;
    } else if (CONTROL.test(name)) {
      error ??= "Artist names cannot contain control characters.";
      skipped++;
    } else if (next.some((n) => normalise(n) === normalise(name))) {
      error ??= `${name} is already in this list.`;
      skipped++;
    } else if (kind === "candidate" && other.some((n) => normalise(n) === normalise(name))) {
      error ??= `${name} is already one of your crowd acts, so it cannot also be a candidate.`;
      skipped++;
    } else if (kind === "crowd" && other.some((n) => normalise(n) === normalise(name))) {
      error ??= `${name} is already one of your candidate acts, so it cannot also be a crowd act.`;
      skipped++;
    } else if (next.length >= max) {
      error ??= `You can add up to ${max} acts here. Remove one to add another.`;
      skipped++;
    } else {
      next.push(name);
      added.push(name);
    }
  }
  return { list: next, added, error, skipped };
}

export interface RoomDraft {
  city: string;
  crowd: readonly string[];
  candidates: readonly string[];
}

export interface FieldProblem {
  /** Id of the control that gets focus. */
  field: "city-field" | "crowd-input" | "candidate-input";
  message: string;
}

function countWord(n: number): string {
  return `${n}`;
}

/** Everything that blocks submit, in page order. Empty means the draft can be sent. */
export function validateDraft(draft: RoomDraft): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const city = draft.city.trim();
  if (city.length === 0) problems.push({ field: "city-field", message: "Enter the city your regular crowd lives in." });
  else if (city.length > MAX_NAME_LENGTH) problems.push({ field: "city-field", message: `City names are limited to ${MAX_NAME_LENGTH} characters.` });
  else if (CONTROL.test(city)) problems.push({ field: "city-field", message: "City names cannot contain control characters." });
  if (draft.crowd.length < MIN_CROWD_ACTS) {
    problems.push({ field: "crowd-input", message: `Add at least ${MIN_CROWD_ACTS} crowd acts. You have ${countWord(draft.crowd.length)}.` });
  }
  if (draft.candidates.length < MIN_CANDIDATE_ACTS) {
    problems.push({ field: "candidate-input", message: `Add at least ${MIN_CANDIDATE_ACTS} candidate acts. You have ${countWord(draft.candidates.length)}.` });
  }
  return problems;
}

/** The reason line under the primary button: names only what is still missing. */
export function disabledReason(draft: RoomDraft): string | null {
  const missing: string[] = [];
  if (draft.city.trim().length === 0) missing.push("a city");
  const crowdLeft = MIN_CROWD_ACTS - draft.crowd.length;
  if (crowdLeft > 0) missing.push(draft.crowd.length === 0 ? `at least ${MIN_CROWD_ACTS} crowd acts` : `${crowdLeft} more crowd ${crowdLeft === 1 ? "act" : "acts"}`);
  const candLeft = MIN_CANDIDATE_ACTS - draft.candidates.length;
  if (candLeft > 0) {
    missing.push(draft.candidates.length === 0 ? `at least ${MIN_CANDIDATE_ACTS} candidate acts` : `${candLeft} more candidate ${candLeft === 1 ? "act" : "acts"}`);
  }
  if (missing.length === 0) return null;
  const joined = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
  return `Add ${joined} to continue.`;
}
