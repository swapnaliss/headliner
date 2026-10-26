"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { addNames, disabledReason, LIMITS, validateDraft, type FieldProblem, type ListKind } from "../roomRules";
import { SAMPLE_ROOM } from "../sampleRoom";
import { ActChip } from "./ActChip";
import { Button } from "./Button";
import { ErrorState } from "./ErrorState";
import { Icon } from "./Icon";
import { ProgressStatus } from "./ProgressStatus";
import { SkeletonList } from "./SkeletonCard";
import { TextField } from "./TextField";
import { isolate } from "./text";

type Phase = "idle" | "submitting" | "error" | "awaiting";

interface AwaitingNotice {
  count: number;
}

/** Client wall-clock cap on one request; the route allows 60 s (ADR 0004). */
const REQUEST_TIMEOUT_MS = 65_000;
const SLOW_AFTER_MS = 20_000;

const GENERIC_FAILURE = "Could not complete the ranking. Your entries are kept. Try again in a moment.";

/** Only these fixed strings are ever shown for a failed request; upstream text is never displayed. */
function failureMessage(status: number | null): string {
  if (status === 429) return "This demo is busy right now. Your entries are kept. Wait a moment and try again.";
  if (status === 400) return "The server did not accept these entries. Check the names and the counts, then try again.";
  if (status === 503) return "Could not reach Qloo. Your entries are kept. Try again.";
  return GENERIC_FAILURE;
}

export function RoomForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [crowd, setCrowd] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [crowdInput, setCrowdInput] = useState("");
  const [candidateInput, setCandidateInput] = useState("");
  const [crowdError, setCrowdError] = useState<string | undefined>();
  const [candidateError, setCandidateError] = useState<string | undefined>();
  const [problems, setProblems] = useState<FieldProblem[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [failure, setFailure] = useState<string>("");
  const [awaiting, setAwaiting] = useState<AwaitingNotice | null>(null);
  const [message, setMessage] = useState("");
  const [seconds, setSeconds] = useState(0);

  const summaryRef = useRef<HTMLDivElement>(null);
  const errorHeadingRef = useRef<HTMLHeadingElement>(null);
  const awaitingRef = useRef<HTMLHeadingElement>(null);
  const crowdInputRef = useRef<HTMLInputElement>(null);
  const candidateInputRef = useRef<HTMLInputElement>(null);
  const pendingFocus = useRef<{ kind: ListKind; index: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const draft = { city, crowd, candidates };
  const reason = disabledReason(draft);
  const busy = phase === "submitting";

  // Focus handling after a chip is removed: next chip, else the add field.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const buttons = document.querySelectorAll<HTMLButtonElement>(`ul[data-list="${target.kind}"] .chip-remove`);
    const next = buttons[Math.min(target.index, buttons.length - 1)];
    if (next) next.focus();
    else (target.kind === "crowd" ? crowdInputRef : candidateInputRef).current?.focus();
  }, [crowd, candidates]);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    setSeconds(0);
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (problems.length > 0) summaryRef.current?.focus();
  }, [problems]);

  useEffect(() => {
    if (phase === "error") errorHeadingRef.current?.focus();
    if (phase === "awaiting") awaitingRef.current?.focus();
  }, [phase]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function add(kind: ListKind) {
    const raw = kind === "crowd" ? crowdInput : candidateInput;
    const list = kind === "crowd" ? crowd : candidates;
    const other = kind === "crowd" ? candidates : crowd;
    const outcome = addNames(kind, list, other, raw);
    const setList = kind === "crowd" ? setCrowd : setCandidates;
    const setErr = kind === "crowd" ? setCrowdError : setCandidateError;
    const setInput = kind === "crowd" ? setCrowdInput : setCandidateInput;
    const noun = LIMITS[kind].noun;
    if (outcome.added.length > 0) {
      setList(outcome.list);
      setInput("");
      setProblems([]);
      const n = outcome.added.length;
      const head = n === 1 ? `${isolate(outcome.added[0] ?? "")} added to ${noun} acts.` : `${n} acts added to ${noun} acts.`;
      const tail = outcome.skipped > 0 ? ` ${outcome.skipped} skipped.` : "";
      setMessage(`${head}${tail} ${outcome.list.length} of ${LIMITS[kind].max}.`);
      setErr(outcome.error ?? undefined);
    } else {
      setErr(outcome.error ?? undefined);
    }
  }

  function remove(kind: ListKind, index: number) {
    const list = kind === "crowd" ? crowd : candidates;
    const name = list[index] ?? "";
    const next = list.filter((_, i) => i !== index);
    pendingFocus.current = { kind, index };
    (kind === "crowd" ? setCrowd : setCandidates)(next);
    (kind === "crowd" ? setCrowdError : setCandidateError)(undefined);
    setMessage(`${isolate(name)} removed. ${next.length} ${LIMITS[kind].noun} ${next.length === 1 ? "act" : "acts"} left.`);
  }

  function onAddKey(kind: ListKind, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      add(kind);
    }
  }

  function onPaste(kind: ListKind, event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!/[,\n\r]/.test(text)) return;
    event.preventDefault();
    const list = kind === "crowd" ? crowd : candidates;
    const other = kind === "crowd" ? candidates : crowd;
    const outcome = addNames(kind, list, other, text);
    if (outcome.added.length > 0) {
      (kind === "crowd" ? setCrowd : setCandidates)(outcome.list);
      setMessage(`${outcome.added.length} acts added. ${outcome.skipped} skipped. ${outcome.list.length} of ${LIMITS[kind].max}.`);
    }
    (kind === "crowd" ? setCrowdError : setCandidateError)(outcome.error ?? undefined);
  }

  function fillSample() {
    setCity(SAMPLE_ROOM.city);
    setCrowd([...SAMPLE_ROOM.crowdActs]);
    setCandidates([...SAMPLE_ROOM.candidateActs]);
    setCrowdInput("");
    setCandidateInput("");
    setCrowdError(undefined);
    setCandidateError(undefined);
    setProblems([]);
    setPhase("idle");
    setMessage(
      `Sample room filled in: ${SAMPLE_ROOM.city}, ${SAMPLE_ROOM.crowdActs.length} crowd acts, ${SAMPLE_ROOM.candidateActs.length} candidate acts. Check the entries, then press Rank these acts.`,
    );
    document.getElementById("rank-button")?.focus();
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const found = validateDraft(draft);
    setProblems(found);
    if (found.length > 0) {
      setPhase("idle");
      return;
    }
    setPhase("submitting");
    setAwaiting(null);
    setMessage(`Ranking ${candidates.length} ${candidates.length === 1 ? "act" : "acts"} for ${isolate(city.trim())}. The first run can take up to a minute.`);
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/slates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ city: city.trim(), crowdActs: crowd, candidateActs: candidates }),
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || typeof body !== "object" || body === null) {
        setFailure(failureMessage(response.status));
        setPhase("error");
        return;
      }
      const result = body as { status?: string; id?: string; ambiguous?: unknown[] };
      if (result.status === "done" && typeof result.id === "string" && /^[A-Za-z0-9_-]{21}$/.test(result.id)) {
        setMessage("Slate ready. Opening it now.");
        router.push(`/slates/${encodeURIComponent(result.id)}`);
        return;
      }
      if (result.status === "awaiting_confirmation") {
        setAwaiting({ count: Array.isArray(result.ambiguous) ? result.ambiguous.length : 0 });
        setPhase("awaiting");
        return;
      }
      setFailure(GENERIC_FAILURE);
      setPhase("error");
    } catch {
      setFailure(GENERIC_FAILURE);
      setPhase("error");
    } finally {
      clearTimeout(timer);
    }
  }

  function focusField(id: string) {
    document.getElementById(id)?.focus();
  }

  const cityProblem = problems.find((p) => p.field === "city-field")?.message;
  const crowdProblem = crowdError ?? problems.find((p) => p.field === "crowd-input")?.message;
  const candidateProblem = candidateError ?? problems.find((p) => p.field === "candidate-input")?.message;

  return (
    <form className="stack" onSubmit={submit} noValidate aria-label="Room setup">
      <div className="stack-sm sample">
        <Button variant="secondary" onClick={fillSample}>
          Fill in the sample room
        </Button>
        <p className="field-hint">A Berlin room with six crowd acts and three candidates, using recorded Qloo responses.</p>
      </div>

      <div role="status" aria-live="polite" className="sr-only" data-testid="live-region">
        {message}
      </div>

      {problems.length > 0 ? (
        <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <h2>{problems.length === 1 ? "Fix 1 thing to continue" : `Fix ${problems.length} things to continue`}</h2>
          <ul className="stack-sm">
            {problems.map((p) => (
              <li key={p.field}>
                <a
                  href={`#${p.field}`}
                  onClick={(e) => {
                    e.preventDefault();
                    focusField(p.field);
                  }}
                >
                  {p.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="panel" aria-labelledby="room-heading">
        <h2 id="room-heading">Your room</h2>
        <TextField
          id="city-field"
          label="City (required)"
          hint="The city your regular crowd lives in."
          value={city}
          onChange={setCity}
          maxLength={200}
          readOnly={busy}
          error={cityProblem}
        />
        <ActList
          kind="crowd"
          heading="Crowd acts: 3 to 6 (required)"
          hint="Artists your regulars already follow."
          items={crowd}
          input={crowdInput}
          setInput={(v) => {
            setCrowdInput(v);
            setCrowdError(undefined);
          }}
          inputRef={crowdInputRef}
          error={crowdProblem}
          busy={busy}
          onAdd={() => add("crowd")}
          onRemove={(i) => remove("crowd", i)}
          onKey={(e) => onAddKey("crowd", e)}
          onPaste={(e) => onPaste("crowd", e)}
          inputId="crowd-input"
        />
      </section>

      <section className="panel" aria-labelledby="cand-heading">
        <h2 id="cand-heading">Acts you are considering</h2>
        <ActList
          kind="candidate"
          heading="Candidate acts: 3 to 12 (required)"
          hint="Acts you are thinking of booking."
          items={candidates}
          input={candidateInput}
          setInput={(v) => {
            setCandidateInput(v);
            setCandidateError(undefined);
          }}
          inputRef={candidateInputRef}
          error={candidateProblem}
          busy={busy}
          onAdd={() => add("candidate")}
          onRemove={(i) => remove("candidate", i)}
          onKey={(e) => onAddKey("candidate", e)}
          onPaste={(e) => onPaste("candidate", e)}
          inputId="candidate-input"
        />
      </section>

      {phase === "error" ? (
        <ErrorState
          title="Could not rank these acts"
          message={failure}
          headingRef={errorHeadingRef}
          actions={
            <Button variant="secondary" onClick={() => void submit()}>
              Try again
            </Button>
          }
        />
      ) : null}

      {phase === "awaiting" && awaiting ? (
        <section className="state" data-tone="neutral" role="status">
          <div className="state-head">
            <Icon name="info" />
            <h2 ref={awaitingRef} tabIndex={-1}>
              Some matches need confirmation
            </h2>
          </div>
          <p>
            {awaiting.count === 1 ? "One name matches" : `${awaiting.count} names match`} more than one Qloo artist. Choosing between matches is not available yet in this version. Rename
            the act (for example add the band name in full) or remove it, then rank again.
          </p>
        </section>
      ) : null}

      {busy ? (
        <section className="stack" aria-labelledby="progress-heading">
          <h2 id="progress-heading">Ranking in progress</h2>
          <ProgressStatus
            message={`Ranking ${candidates.length} ${candidates.length === 1 ? "act" : "acts"}. Checking names with Qloo, then comparing audiences.`}
            slowNotice={
              seconds >= SLOW_AFTER_MS / 1000
                ? `Still working. ${seconds} seconds so far. Qloo requests that are not saved yet take longer.`
                : undefined
            }
          />
          <SkeletonList count={Math.min(candidates.length, 3)} label="Acts being ranked" />
        </section>
      ) : null}

      <div className="stack-sm">
        <details className="disclosure">
          <summary>Describe it in one sentence</summary>
          <p className="field-hint">Coming soon. The form above works on its own.</p>
        </details>
      </div>

      <div className="stack-sm">
        <Button
          id="rank-button"
          type="submit"
          loading={busy}
          loadingLabel="Ranking…"
          disabled={reason !== null}
          describedBy={reason ? "rank-reason" : "rank-privacy"}
          onClick={() => {
            if (reason !== null) void submit();
          }}
        >
          Rank these acts
        </Button>
        {reason ? (
          <p className="field-hint" id="rank-reason">
            {reason}
          </p>
        ) : null}
        <p className="field-hint" id="rank-privacy">
          Enter artist names and a city only. Do not enter personal details.
        </p>
        {demoMode ? (
          <p className="field-hint">
            This demo runs on recorded Qloo responses, so only artists in those recordings can be matched. The sample room always works.
          </p>
        ) : null}
      </div>
    </form>
  );
}

interface ActListProps {
  kind: ListKind;
  heading: string;
  hint: string;
  items: string[];
  input: string;
  setInput: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  inputId: string;
  error: string | undefined;
  busy: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onKey: (e: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
}

function ActList({ kind, heading, hint, items, input, setInput, inputRef, inputId, error, busy, onAdd, onRemove, onKey, onPaste }: ActListProps) {
  const { max } = LIMITS[kind];
  const full = items.length >= max;
  const noun = kind === "crowd" ? "crowd" : "candidate";
  const headingId = `${kind}-heading`;
  const countId = `${kind}-count`;
  const fullId = `${kind}-full`;
  return (
    <div className="stack-sm" role="group" aria-labelledby={headingId}>
      <p className="field-label" id={headingId}>
        {heading}
      </p>
      <p className="field-hint">{hint}</p>
      <ul className="chip-row" aria-label={kind === "crowd" ? "Crowd acts" : "Candidate acts"} data-list={kind}>
        {items.map((name, i) => (
          <ActChip key={name} name={name} listLabel={`${noun} acts`} onRemove={() => onRemove(i)} locked={busy} />
        ))}
      </ul>
      <div className="stack-sm">
        <TextField
          id={inputId}
          label={`Add a ${noun} act`}
          hint="Type one name and press Enter, or paste a list separated by commas or line breaks."
          value={input}
          onChange={setInput}
          onKeyDown={onKey}
          inputRef={inputRef}
          readOnly={busy || full}
          error={error}
          describedBy={full ? fullId : countId}
          onPaste={onPaste}
        />
        <div>
          <Button variant="secondary" onClick={onAdd} disabled={full || busy} describedBy={full ? fullId : undefined}>
            {`Add to ${noun} acts`}
          </Button>
        </div>
      </div>
      <p className="field-hint" id={countId}>
        {items.length} of {max} added
      </p>
      {full ? (
        <p className="field-hint" id={fullId}>
          {kind === "crowd" ? "Crowd acts" : "Candidate acts"} are full ({max}). Remove one to add another.
        </p>
      ) : null}
    </div>
  );
}
