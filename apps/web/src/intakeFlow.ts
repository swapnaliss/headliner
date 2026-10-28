import { MIN_CANDIDATE_ACTS, MIN_CROWD_ACTS } from "@headliner/core";
import { addNames, normalise } from "./roomRules";

/** One-sentence description limits: the form field stops at 400 characters; the route accepts 500 (sentence plus one answer). */
export const SENTENCE_MAX = 400;
export const INTAKE_REQUEST_MAX = 500;
/** Joins the first description and the booker's answer to the one clarifying question (the shape the recorded traces use). */
export const ANSWER_JOINER = " Answer: ";

/**
 * The one example sentence the demo can read without a model: its trace is recorded in `fixtures/agent/intake`
 * (a test keeps the two equal). In live mode any sentence works.
 */
export const DEMO_EXAMPLE_SENTENCE = "200-cap venue in Leipzig, our regulars love Khruangbin and Bonobo";

export interface ProposedRoom {
  city: string;
  crowdActs: readonly string[];
  candidateActs: readonly string[];
}

export interface RoomDraftState {
  city: string;
  crowd: readonly string[];
  candidates: readonly string[];
}

export interface AppliedProposal {
  city: string;
  crowd: string[];
  candidates: string[];
  /** The note shown after the form is filled; names only counts, never the (untrusted) text of a name. */
  note: string;
  complete: boolean;
}

function joinParts(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const acts = (n: number): string => `${n} ${n === 1 ? "act" : "acts"}`;

/**
 * Puts a proposed room into the form. The proposal only replaces what it supplies (a list it left empty keeps what
 * the booker typed); the list rules (no duplicates, crowd and candidates disjoint, caps) are the form's own.
 * Everything still goes through the match-confirmation screen: nothing is ranked here.
 */
export function applyProposal(current: RoomDraftState, proposal: ProposedRoom): AppliedProposal {
  const city = proposal.city.trim().length > 0 ? proposal.city.trim() : current.city;
  const crowd = proposal.crowdActs.length > 0 ? addNames("crowd", [], [], proposal.crowdActs.join("\n")).list : [...current.crowd];
  const taken = new Set(crowd.map(normalise));
  const candidatesRaw = proposal.candidateActs.filter((n) => !taken.has(normalise(n)));
  const candidates = proposal.candidateActs.length > 0 ? addNames("candidate", [], crowd, candidatesRaw.join("\n")).list : [...current.candidates];

  const found: string[] = [];
  const missing: string[] = [];
  if (city.length > 0) found.push("a city");
  else missing.push("no city");
  if (crowd.length >= MIN_CROWD_ACTS) found.push(`${acts(crowd.length)} the crowd follows`);
  else if (crowd.length > 0) missing.push(`only ${acts(crowd.length)} the crowd follows (${MIN_CROWD_ACTS} needed)`);
  else missing.push("no crowd acts");
  if (candidates.length >= MIN_CANDIDATE_ACTS) found.push(`${acts(candidates.length)} you are considering`);
  else if (candidates.length > 0) missing.push(`only ${acts(candidates.length)} you are considering (${MIN_CANDIDATE_ACTS} needed)`);
  else missing.push("no candidate acts");

  const complete = missing.length === 0;
  const note = complete
    ? "We filled in the form from your description. Check each entry; nothing is ranked yet."
    : `We found ${found.length > 0 ? joinParts(found) : "nothing we could use"} but ${joinParts(missing)}. Add what is missing in the form; nothing is ranked yet.`;
  return { city, crowd, candidates, note, complete };
}

/** The request text for the second call: the first description plus the booker's answer, within the route's 500 characters. */
export function withAnswer(sentence: string, answer: string): { text: string; tooLong: boolean } {
  const text = `${sentence.trim()}${ANSWER_JOINER}${answer.trim()}`;
  return { text, tooLong: text.length > INTAKE_REQUEST_MAX };
}

export type IntakeReply =
  | { kind: "room"; room: ProposedRoom }
  | { kind: "clarification"; question: string }
  | { kind: "unreadable"; demoUnrecorded: boolean }
  | { kind: "demo-limit" }
  | { kind: "busy" };

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/** Reads a `/api/intake` response. Only fixed fields are used; server text is never displayed. */
export function readIntakeReply(status: number, code: string | null, body: unknown): IntakeReply {
  if (status === 429) return code === "demo_limit_reached" ? { kind: "demo-limit" } : { kind: "busy" };
  if (status < 200 || status >= 300 || typeof body !== "object" || body === null) return { kind: "unreadable", demoUnrecorded: false };
  const b = body as { status?: unknown; reason?: unknown; room?: unknown; clarification?: unknown };
  if (b.status === "room" && typeof b.room === "object" && b.room !== null) {
    const r = b.room as { city?: unknown; crowdActs?: unknown; candidateActs?: unknown };
    if (typeof r.city === "string" && isStringArray(r.crowdActs) && isStringArray(r.candidateActs)) {
      return { kind: "room", room: { city: r.city, crowdActs: r.crowdActs, candidateActs: r.candidateActs } };
    }
  }
  if (b.status === "clarification" && typeof b.clarification === "string" && b.clarification.length > 0) {
    return { kind: "clarification", question: b.clarification };
  }
  return { kind: "unreadable", demoUnrecorded: b.status === "deterministic" && (b.reason === "no_recording" || b.reason === "llm_unavailable") };
}

