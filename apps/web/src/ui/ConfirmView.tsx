"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MatchCandidate, MatchRowState } from "@headliner/core";
import { reasonParts, SKIP, statusLine, summarise, toChoices, type Decisions } from "../confirmRules";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { Icon } from "./Icon";
import { MatchPicker } from "./MatchPicker";
import { isolate } from "./text";

export interface ConfirmRow {
  readonly role: "crowd" | "candidate";
  readonly actInput: string;
  readonly state: MatchRowState;
  readonly candidates: readonly MatchCandidate[];
}

export interface ConfirmViewProps {
  readonly runId: string;
  /** The city string exactly as the heatmap query will receive it. */
  readonly locationDisplay: string;
  readonly rows: readonly ConfirmRow[];
  readonly demoMode: boolean;
}

const REQUEST_TIMEOUT_MS = 65_000;
const ROLE_LABEL = { crowd: "Crowd act", candidate: "Candidate act" } as const;

type Phase = "idle" | "submitting" | "error" | "gone";

/** Fixed messages only; upstream text is never shown. */
function failureMessage(status: number | null): string {
  if (status === 429) return "This demo is busy right now. Your choices are kept. Wait a moment and try again.";
  if (status === 503) return "Could not reach Qloo. Your choices are kept. Try again.";
  return "Could not complete the ranking. Your choices are kept. Try again in a moment.";
}

const NO_MATCH_REASON: Record<Exclude<MatchRowState, "exact" | "ambiguous">, { title: (name: string) => string; reason: (name: string) => string }> = {
  none: {
    title: (n) => `No Qloo match for ${n}`,
    reason: () => "Qloo returned no artist with this name. Check the spelling or try the name the artist uses most.",
  },
  "not-in-recordings": {
    title: (n) => `${n} is not in the recorded responses`,
    reason: (n) => `This demo only has recorded responses and does not include ${n}. Use the sample room or remove it.`,
  },
  "search-failed": {
    title: (n) => `Could not search for ${n}`,
    reason: () => "Qloo could not be reached for this name. Go back and try again, or leave it out.",
  },
};

export function ConfirmView({ runId, locationDisplay, rows, demoMode }: ConfirmViewProps) {
  const router = useRouter();
  const [decisions, setDecisions] = useState<Decisions>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [failure, setFailure] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const errorRef = useRef<HTMLHeadingElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const focusAfter = useRef<string | null>(null);

  const summary = summarise(rows, decisions);
  const reason = reasonParts(summary);
  const busy = phase === "submitting";
  const open = rows.filter((r) => r.state !== "exact" && decisions[r.actInput] === undefined);
  const confirmedRows = rows
    .filter((r) => r.state === "exact" || (decisions[r.actInput] !== undefined && decisions[r.actInput] !== SKIP))
    .map((row) => ({ row, chosen: row.state === "exact" ? undefined : row.candidates.find((c) => c.entityId === decisions[row.actInput]) }));
  const leftOutRows = rows.filter((r) => decisions[r.actInput] === SKIP);
  const roleCount = (role: "crowd" | "candidate"): number => rows.filter((r) => r.role === role && decisions[r.actInput] !== SKIP).length;

  useEffect(() => {
    if (phase === "error") errorRef.current?.focus();
  }, [phase]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // A row moves between sections when decided: keep focus on that row's next control.
  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target) document.getElementById(target)?.focus();
  }, [decisions]);

  function decide(actInput: string, value: string | undefined) {
    if (busy) return;
    const role = rows.find((r) => r.actInput === actInput)?.role ?? "candidate";
    const id = rowId(role, actInput);
    focusAfter.current = value === undefined ? id : value === SKIP ? `back-${id}` : `change-${id}`;
    const next = { ...decisions, [actInput]: value };
    setDecisions(next);
    const after = summarise(rows, next);
    setAnnouncement(
      value === undefined
        ? `${isolate(actInput)} reopened.`
        : value === SKIP
          ? `${isolate(actInput)} left out. ${after.blockedReason?.kind === "few" ? (reasonParts(after)?.text ?? "") : statusLine(after)}`
          : `${isolate(actInput)} confirmed. ${statusLine(after)}`,
    );
  }

  function focusFirstPending() {
    const first = summary.pending[0];
    if (first) document.getElementById(rowId(first.role, first.actInput))?.focus();
  }

  async function rank() {
    if (busy) return;
    if (summary.blockedReason !== null) {
      if (summary.blockedReason.kind === "pending") focusFirstPending();
      setAnnouncement(`${reason?.text ?? ""}${reason && reason.names.length > 0 ? `: ${reason.names.map(isolate).join(", ")}` : ""}.`);
      return;
    }
    setPhase("submitting");
    setAnnouncement("Ranking the acts. The first run can take up to a minute.");
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`/api/slates/${encodeURIComponent(runId)}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choices: toChoices(rows, decisions) }),
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (response.status === 404) {
        setPhase("gone");
        return;
      }
      const result = typeof body === "object" && body !== null ? (body as { status?: string; id?: string }) : {};
      if (response.ok && result.status === "done" && typeof result.id === "string" && /^[A-Za-z0-9_-]{21}$/.test(result.id)) {
        setAnnouncement("Slate ready. Opening it now.");
        router.push(`/slates/${encodeURIComponent(result.id)}`);
        return;
      }
      setFailure(failureMessage(response.ok ? null : response.status));
      setPhase("error");
    } catch {
      setFailure(failureMessage(null));
      setPhase("error");
    } finally {
      clearTimeout(timer);
    }
  }

  if (phase === "gone") {
    return (
      <main id="main" tabIndex={-1} className="main shell stack">
        <EmptyState level={1} title="This run is no longer available." reason="It may have expired or already been ranked." action={<a className="btn" data-variant="secondary" href="/">Start over</a>} />
      </main>
    );
  }

  const describedBy = reason ? "rank-reason" : undefined;
  const rankLabel = "Rank these acts";

  return (
    <div className="main shell">
      <div className="two-col">
        <main id="main" tabIndex={-1} className="stack">
          <p>
            <a href="/" className="confirm-back">
              Back to edit the room
            </a>
            <span className="field-hint back-note">Your confirmations are kept for names you do not change.</span>
          </p>
          <div className="stack-sm">
            <h1>Confirm the matches</h1>
            <p role="status" aria-live="polite" data-testid="status-line">
              {statusLine(summary)}
            </p>
            {summary.pending.length > 0 ? (
              <div>
                <Button variant="secondary" onClick={focusFirstPending}>
                  Go to the first one
                </Button>
              </div>
            ) : null}
          </div>

          <div role="status" aria-live="polite" className="sr-only" data-testid="live-region">
            {announcement}
          </div>

          {phase === "error" ? (
            <ErrorState
              title="Could not rank these acts"
              message={failure}
              headingRef={errorRef}
              actions={
                <>
                  <Button onClick={() => void rank()}>Try again</Button>
                  <a className="btn" data-variant="secondary" href="/">
                    Back to edit the room
                  </a>
                </>
              }
            />
          ) : null}

          {open.length > 0 ? (
            <section className="stack" aria-labelledby="needs-heading">
              <h2 id="needs-heading">Needs your choice</h2>
              {open.map((row) => (
                <article key={`${row.role}:${row.actInput}`} className="match-row" aria-labelledby={rowId(row.role, row.actInput)}>
                  <p className="match-role">{ROLE_LABEL[row.role]}</p>
                  {row.state === "ambiguous" ? (
                    <>
                      <MatchPicker id={rowId(row.role, row.actInput)} typedName={row.actInput} hits={row.candidates} value={null} locked={busy} onChange={(value) => decide(row.actInput, value)} />
                      <div>
                        <Button variant="quiet" onClick={() => decide(row.actInput, SKIP)}>
                          Remove act
                        </Button>
                      </div>
                    </>
                  ) : (
                    <NoMatch id={rowId(row.role, row.actInput)} typedName={row.actInput} state={row.state} onRemove={() => decide(row.actInput, SKIP)} />
                  )}
                </article>
              ))}
            </section>
          ) : null}

          {confirmedRows.length > 0 ? (
            <section className="stack-sm" aria-labelledby="confirmed-heading">
              <h2 id="confirmed-heading">Confirmed ({confirmedRows.length})</h2>
              <ul className="confirmed-list">
                {confirmedRows.map(({ row, chosen }) => {
                  const hitName = chosen?.name ?? row.candidates[0]?.name ?? row.actInput;
                  return (
                    <li key={`${row.role}:${row.actInput}`} className="confirmed-row">
                      <span className="confirmed-main">
                        <span className="match-role">{ROLE_LABEL[row.role]}</span>
                        <span className="entity" dir="auto">
                          <bdi>{hitName}</bdi>
                          {hitName !== row.actInput ? (
                            <>
                              {" "}
                              (you typed <bdi>{row.actInput}</bdi>)
                            </>
                          ) : null}
                        </span>
                        {chosen ? (
                          <span className="match-chosen">
                            <Icon name="info" /> Match chosen by you
                          </span>
                        ) : null}
                      </span>
                      <span className="match-selected">
                        <Icon name="check" /> Confirmed
                      </span>
                      {chosen ? (
                        <Button id={`change-${rowId(row.role, row.actInput)}`} variant="quiet" onClick={() => decide(row.actInput, undefined)}>
                          Change
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {leftOutRows.length > 0 ? (
            <section className="stack-sm" aria-labelledby="left-heading">
              <h2 id="left-heading">Left out ({leftOutRows.length})</h2>
              <ul className="confirmed-list">
                {leftOutRows.map((row) => (
                  <li key={`${row.role}:${row.actInput}`} className="confirmed-row">
                    <span className="confirmed-main">
                      <span className="match-role">{ROLE_LABEL[row.role]}</span>
                      <span className="entity" dir="auto">
                        <bdi>{row.actInput}</bdi>
                      </span>
                    </span>
                    <Button id={`back-${rowId(row.role, row.actInput)}`} variant="quiet" onClick={() => decide(row.actInput, undefined)}>
                      Put back
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </main>

        <aside className="stack" aria-label="Summary">
          <section className="panel" aria-labelledby="summary-heading">
            <h2 id="summary-heading">Summary</h2>
            <ul className="summary-list">
              <li>{summary.pending.length} need a choice</li>
              <li>{summary.confirmed} confirmed</li>
              {summary.leftOut > 0 ? <li>{summary.leftOut} left out</li> : null}
              <li>
                {roleCount("crowd")} crowd acts, {roleCount("candidate")} candidate acts
              </li>
              <li data-testid="location-line">
                City for the heatmap lookups: <bdi className="entity" dir="auto">{locationDisplay}</bdi>
              </li>
              {demoMode ? <li>Demo mode: only names with recorded Qloo responses can be matched.</li> : null}
            </ul>
            <Button id="rank-button" loading={busy} loadingLabel="Ranking…" disabled={summary.blockedReason !== null} describedBy={describedBy} onClick={() => void rank()}>
              {rankLabel}
            </Button>
            {reason ? (
              <p id="rank-reason" className="field-hint">
                {reason.text}
                {reason.names.length > 0 ? ": " : null}
                {reason.names.map((n, i) => (
                  <span key={`${n}-${i}`}>
                    {i > 0 ? ", " : null}
                    {n.startsWith("and ") ? n : <bdi className="entity" dir="auto">{n}</bdi>}
                  </span>
                ))}
                {reason.names.length > 0 ? "." : null}
              </p>
            ) : (
              <p id="rank-reason" className="field-hint">
                Everything is confirmed. Ranking uses the Qloo entities shown here.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function rowId(role: string, actInput: string): string {
  return `row-${role}-${Array.from(actInput).map((c) => c.codePointAt(0)?.toString(16) ?? "").join("").slice(0, 40)}`;
}

function NoMatch({ id, typedName, state, onRemove }: { id: string; typedName: string; state: MatchRowState; onRemove: () => void }) {
  const copy = NO_MATCH_REASON[state as keyof typeof NO_MATCH_REASON];
  return (
    <div className="stack-sm">
      <h3 id={id} tabIndex={-1}>
        You typed: <bdi className="entity" dir="auto">{typedName}</bdi>
      </h3>
      <p>
        <strong>
          <bdi dir="auto">{copy.title(typedName)}</bdi>
        </strong>
      </p>
      <p>
        <bdi dir="auto">{copy.reason(typedName)}</bdi>
      </p>
      <div className="state-actions">
        {state === "not-in-recordings" ? (
          <a className="btn" data-variant="secondary" href="/?sample=1">
            Use the sample room
          </a>
        ) : null}
        <Button variant="quiet" onClick={onRemove}>
          Remove act
        </Button>
      </div>
    </div>
  );
}
