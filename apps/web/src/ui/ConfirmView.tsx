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
    reason: () => "Qloo returned no artist with this name. Check the spelling in the room, or leave this act out.",
  },
  "not-in-recordings": {
    title: (n) => `${n} is not in the recorded responses`,
    reason: (n) => `This demo only has recorded responses and does not include ${n}. Go back and use the sample room, or leave it out.`,
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

  const summary = summarise(rows, decisions);
  const reason = reasonParts(summary);
  const busy = phase === "submitting";
  const needing = rows.filter((r) => r.state !== "exact");
  const exact = rows.filter((r) => r.state === "exact");
  const roleCount = (role: "crowd" | "candidate"): number => rows.filter((r) => r.role === role && decisions[r.actInput] !== SKIP).length;

  useEffect(() => {
    if (phase === "error") errorRef.current?.focus();
  }, [phase]);
  useEffect(() => () => abortRef.current?.abort(), []);

  function decide(actInput: string, value: string | undefined) {
    if (busy) return;
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
            <a href="/" className="back-link">
              Back to edit the room
            </a>
          </p>
          <div className="stack-sm">
            <h1>Confirm the matches</h1>
            <p role="status" aria-live="polite" data-testid="status-line">
              {statusLine(summary)}
            </p>
            <p className="field-hint" data-testid="location-line">
              City for the heatmap lookups: <bdi className="entity" dir="auto">{locationDisplay}</bdi>
            </p>
            {demoMode ? <p className="field-hint">Demo mode: only names with recorded Qloo responses can be matched.</p> : null}
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
              kept="Your choices are kept on this page."
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

          {needing.length > 0 ? (
            <section className="stack" aria-labelledby="needs-heading">
              <h2 id="needs-heading">Needs your choice</h2>
              {needing.map((row) => {
                const decision = decisions[row.actInput];
                return (
                  <article key={`${row.role}:${row.actInput}`} className="match-row" aria-labelledby={rowId(row.role, row.actInput)}>
                    <p className="match-role">{ROLE_LABEL[row.role]}</p>
                    {row.state === "ambiguous" ? (
                      <MatchPicker
                        id={rowId(row.role, row.actInput)}
                        typedName={row.actInput}
                        hits={row.candidates}
                        value={decision ?? null}
                        locked={busy}
                        onChange={(value) => decide(row.actInput, value)}
                      />
                    ) : (
                      <NoMatch id={rowId(row.role, row.actInput)} typedName={row.actInput} state={row.state} left={decision === SKIP} onChange={(skip) => decide(row.actInput, skip ? SKIP : undefined)} />
                    )}
                    {row.state === "ambiguous" && decision !== undefined && decision !== SKIP ? <p className="match-chosen"><Icon name="info" /> Match chosen by you</p> : null}
                    {row.state === "ambiguous" ? (
                      <div>
                        <Button variant="quiet" onClick={() => decide(row.actInput, decision === SKIP ? undefined : SKIP)}>
                          {decision === SKIP ? "Put this act back" : "Remove act"}
                        </Button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ) : null}

          {exact.length > 0 ? (
            <section className="stack-sm" aria-labelledby="confirmed-heading">
              <h2 id="confirmed-heading">Confirmed ({exact.length})</h2>
              <p className="field-hint">These names matched one Qloo artist exactly, so they need no choice.</p>
              <ul className="chip-row" aria-label="Confirmed names">
                {exact.map((row) => (
                  <li key={`${row.role}:${row.actInput}`} className="tag-chip">
                    <Icon name="check" />
                    <span className="sr-only">{ROLE_LABEL[row.role]}: </span>
                    <bdi className="entity" dir="auto">
                      {row.candidates[0]?.name ?? row.actInput}
                    </bdi>
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
              <li>{summary.decided + summary.exact} confirmed</li>
              <li>
                {roleCount("crowd")} crowd acts, {roleCount("candidate")} candidate acts
              </li>
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

function NoMatch({ id, typedName, state, left, onChange }: { id: string; typedName: string; state: MatchRowState; left: boolean; onChange: (skip: boolean) => void }) {
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
      {left ? <p className="match-chosen"><Icon name="check" /> Left out of this slate</p> : null}
      <div>
        <Button variant="quiet" onClick={() => onChange(!left)}>
          {left ? "Put this act back" : "Remove act"}
        </Button>
      </div>
    </div>
  );
}
