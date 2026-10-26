import { MIN_CANDIDATE_ACTS, MIN_CROWD_ACTS, type MatchRowState } from "@headliner/core";

export const SKIP = "skip" as const;

export interface RowView {
  readonly role: "crowd" | "candidate";
  readonly actInput: string;
  readonly state: MatchRowState;
}

/** The user's decision per typed name: an entity id, `skip`, or nothing yet. */
export type Decisions = Readonly<Record<string, string | undefined>>;

export function needsDecision(row: RowView): boolean {
  return row.state !== "exact";
}

export interface Summary {
  readonly total: number;
  /** Rows that need a decision and have none. */
  readonly pending: readonly RowView[];
  readonly decided: number;
  readonly exact: number;
  /** Acts left per role after the skips chosen so far. */
  readonly remaining: { readonly crowd: number; readonly candidate: number };
  /** Why ranking is blocked, or null when it is allowed. Names are untrusted: render as text. */
  readonly blockedReason: { readonly kind: "pending"; readonly pending: readonly RowView[] } | { readonly kind: "few"; readonly role: "crowd" | "candidate"; readonly remaining: number } | null;
}

/** Counts and the blocking reason for the confirm screen. A row with no decision always blocks; so does a role below its minimum. */
export function summarise(rows: readonly RowView[], decisions: Decisions): Summary {
  const pending = rows.filter((r) => needsDecision(r) && decisions[r.actInput] === undefined);
  const skipped = (r: RowView): boolean => decisions[r.actInput] === SKIP;
  const left = (role: "crowd" | "candidate"): number => rows.filter((r) => r.role === role && !skipped(r)).length;
  const remaining = { crowd: left("crowd"), candidate: left("candidate") };
  let blockedReason: Summary["blockedReason"] = null;
  if (pending.length > 0) blockedReason = { kind: "pending", pending };
  else if (remaining.crowd < MIN_CROWD_ACTS) blockedReason = { kind: "few", role: "crowd", remaining: remaining.crowd };
  else if (remaining.candidate < MIN_CANDIDATE_ACTS) blockedReason = { kind: "few", role: "candidate", remaining: remaining.candidate };
  return {
    total: rows.length,
    pending,
    decided: rows.filter((r) => needsDecision(r) && decisions[r.actInput] !== undefined).length,
    exact: rows.filter((r) => !needsDecision(r)).length,
    remaining,
    blockedReason,
  };
}

/** Plain-text reason shown under the Rank button (names are inserted by the caller as text). */
export function reasonParts(summary: Summary): { text: string; names: string[] } | null {
  const reason = summary.blockedReason;
  if (reason === null) return null;
  if (reason.kind === "few") return { text: `Add another ${reason.role} act: only ${reason.remaining} remain.`, names: [] };
  const names = reason.pending.map((r) => r.actInput);
  const shown = names.slice(0, 3);
  const more = names.length - shown.length;
  return { text: `${names.length} ${names.length === 1 ? "name still needs" : "names still need"} your decision`, names: more > 0 ? [...shown, `and ${more} more`] : shown };
}

/** The status sentence (zero parts omitted). */
export function statusLine(summary: Summary): string {
  const waiting = summary.pending.length;
  if (waiting === 0 && summary.total > 0) return `All ${summary.total} names confirmed.`;
  return `${waiting} ${waiting === 1 ? "name needs" : "names need"} your choice, ${summary.decided + summary.exact} confirmed.`;
}

/** The body for POST /api/slates/:runId/confirm: one choice per row that needs a decision. */
export function toChoices(rows: readonly RowView[], decisions: Decisions): { actInput: string; entityId: string }[] {
  const seen = new Set<string>();
  const out: { actInput: string; entityId: string }[] = [];
  for (const row of rows) {
    const decision = decisions[row.actInput];
    if (!needsDecision(row) || decision === undefined || seen.has(row.actInput)) continue;
    seen.add(row.actInput);
    out.push({ actInput: row.actInput, entityId: decision });
  }
  return out;
}
