/**
 * Input guardrails, applied before any model call (ticket M3-01, ADR 0009, ADR 0003 limits).
 * The explanation (M3-02) reuses these helpers.
 */
export const MAX_INPUT_CHARS = 500;
export const MAX_NAME_CHARS = 80;
export const MAX_CROWD_ACTS = 6;
export const MAX_CANDIDATE_ACTS = 12;
export const MAX_CITIES = 5;
export const MAX_QUESTION_CHARS = 300;

const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]/u;
const CONTROL_G = /[\p{Cc}\p{Zl}\p{Zp}]/gu;

export type InputRejection = "not_text" | "empty" | "too_long" | "control_characters";

export type SanitizedInput =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: InputRejection };

/**
 * Tabs and line breaks become single spaces (a pasted sentence may wrap); any other control,
 * line-separator or paragraph-separator character rejects the input. Length is measured on the
 * raw input, so 501 characters are rejected even if some are spaces.
 */
export function sanitizeInput(raw: unknown): SanitizedInput {
  if (typeof raw !== "string") return { ok: false, reason: "not_text" };
  if (raw.length > MAX_INPUT_CHARS) return { ok: false, reason: "too_long" };
  const spaced = raw.replace(/[\t\n\r]+/g, " ");
  if (CONTROL.test(spaced)) return { ok: false, reason: "control_characters" };
  const text = spaced.replace(/ {2,}/g, " ").trim();
  if (text.length === 0) return { ok: false, reason: "empty" };
  return { ok: true, text };
}

/**
 * Cleans a third-party string (a Qloo entity name) before it reaches a prompt: control characters
 * removed, whitespace collapsed, capped at 80 characters. It is still untrusted text.
 */
export function cleanThirdPartyText(value: string, max: number = MAX_NAME_CHARS): string {
  return value.replace(CONTROL_G, " ").replace(/ {2,}/g, " ").trim().slice(0, max);
}

/** Case-insensitive de-duplication that keeps the first spelling and the original order. */
export function dedupeNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const key = n.normalize("NFKC").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

const fold = (v: string): string => v.normalize("NFD").replace(/\p{M}/gu, "").replace(/ø/gi, "o").replace(/æ/gi, "ae").replace(/ß/g, "ss").replace(/ł/gi, "l").replace(/đ/gi, "d").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Grounding for intake: every act and city the model submits must literally appear in the booker's
 * sentence (case, accents and spacing ignored). A small model otherwise pads the room with names it
 * saw in tool results or made up. Returns schema-style paths of the offenders (never their text).
 */
export function findUngrounded(
  sentence: string,
  room: { readonly city: string; readonly crowdActs: readonly string[]; readonly candidateActs: readonly string[]; readonly cities: readonly string[] },
): string[] {
  const haystack = fold(sentence);
  const bad: string[] = [];
  const check = (path: string, value: string): void => {
    if (!haystack.includes(fold(value))) bad.push(path);
  };
  check("city", room.city);
  room.crowdActs.forEach((n, i) => check(`crowdActs.${i}`, n));
  room.candidateActs.forEach((n, i) => check(`candidateActs.${i}`, n));
  room.cities.forEach((n, i) => check(`cities.${i}`, n));
  return bad;
}
