"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_EXAMPLE_SENTENCE, readIntakeReply, SENTENCE_MAX, withAnswer, type ProposedRoom } from "../intakeFlow";
import { Button } from "./Button";
import { errorCode } from "./errorCode";
import { ErrorState } from "./ErrorState";
import { TextArea } from "./TextArea";

type Phase = "idle" | "reading" | "clarify" | "done" | "failed";

/** The intake route allows 60 s (three model turns); the client gives up a little after that. */
const REQUEST_TIMEOUT_MS = 65_000;

const FAILURE_BASE = "We could not read that description. The form above works without it.";

export interface IntakeAssistProps {
  demoMode: boolean;
  /** Puts the proposed room into the form and returns the note to show; nothing is ranked. */
  onProposal: (room: ProposedRoom) => string;
  /** Announced through the form's own live region. */
  announce: (message: string) => void;
}

/**
 * "Describe it in one sentence" (screen-room-setup.md). The sentence is the only free text sent to an AI model, so the
 * disclosure sits next to the field. The reply is a proposal: it fills the same fields the booker can type into, and
 * the names still go through match confirmation. Every failure leaves the form usable and shows a fixed message.
 */
export function IntakeAssist({ demoMode, onProposal, announce }: IntakeAssistProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sentence, setSentence] = useState("");
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [note, setNote] = useState("");
  const [failure, setFailure] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const noteRef = useRef<HTMLParagraphElement>(null);
  const failureRef = useRef<HTMLHeadingElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = phase === "reading";

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (phase === "done") noteRef.current?.focus();
    if (phase === "failed") failureRef.current?.focus();
    if (phase === "clarify") questionRef.current?.focus();
  }, [phase]);

  async function send(text: string, clarified: boolean): Promise<void> {
    if (busy) return;
    setPhase("reading");
    setFieldError(undefined);
    announce("Reading your description.");
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(clarified ? { text, clarified: true } : { text }),
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      const reply = readIntakeReply(response.status, errorCode(body), body);
      switch (reply.kind) {
        case "room": {
          const message = onProposal(reply.room);
          setNote(message);
          setPhase("done");
          announce(message);
          return;
        }
        case "clarification":
          if (clarified) {
            fail(FAILURE_BASE);
            return;
          }
          setQuestion(reply.question);
          setAnswer("");
          setPhase("clarify");
          announce("One question before the form can be filled.");
          return;
        case "demo-limit":
          fail("The daily limit for reading descriptions has been reached. The form above works without it, and the limit resets at midnight UTC.");
          return;
        case "busy":
          fail("This demo is busy right now. The form above works without it. Wait a moment and try again.");
          return;
        case "unreadable":
          fail(reply.demoUnrecorded && demoMode ? `${FAILURE_BASE} This demo can only read its recorded example sentence.` : FAILURE_BASE);
          return;
      }
    } catch {
      fail(FAILURE_BASE);
    } finally {
      clearTimeout(timer);
    }
  }

  function fail(message: string): void {
    setFailure(message);
    setPhase("failed");
    announce(message);
  }

  function readDescription(): void {
    if (sentence.trim().length === 0) {
      setFieldError("Write a sentence about your room first.");
      return;
    }
    setQuestion("");
    void send(sentence, false);
  }

  function sendAnswer(): void {
    if (answer.trim().length === 0) {
      setFieldError("Write your answer first.");
      return;
    }
    const joined = withAnswer(sentence, answer);
    if (joined.tooLong) {
      setFieldError("Your description and answer are too long together. Shorten the answer.");
      return;
    }
    void send(joined.text, true);
  }

  const askingAnswer = phase === "clarify" || (busy && question !== "");

  return (
    <details
      className="disclosure"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      data-testid="intake-assist"
    >
      <summary>Describe it in one sentence</summary>
      <div className="intake" aria-busy={busy ? "true" : undefined}>
        <TextArea
          id="intake-sentence"
          label="Describe your room"
          hint={
            demoMode
              ? "This demo can read one recorded example sentence. Press Use the example sentence to try it, or fill in the form below yourself."
              : "For example: Leipzig club, our regulars follow Moderat, Apparat and Modeselektor, and we are considering Khruangbin and Radiohead."
          }
          value={sentence}
          onChange={(v) => {
            setSentence(v);
            setFieldError(undefined);
          }}
          maxLength={SENTENCE_MAX}
          readOnly={busy || askingAnswer}
          error={askingAnswer ? undefined : fieldError}
          describedBy="intake-ai"
        />
        <p className="field-hint" id="intake-ai">
          This description is sent to an AI model to read it. Do not include personal details. Nothing you type here is sent to Qloo except the artist names and city after you press Rank these acts.
        </p>
        <p className="field-hint" aria-hidden="true">
          {sentence.length} of {SENTENCE_MAX} characters
        </p>

        {phase === "clarify" || (busy && question !== "") ? (
          <div className="stack-sm" role="group" aria-labelledby="intake-question">
            <p className="field-label" id="intake-question">
              {question}
            </p>
            <TextArea id="intake-answer" label="Your answer" value={answer} onChange={(v) => { setAnswer(v); setFieldError(undefined); }} maxLength={SENTENCE_MAX} readOnly={busy} error={fieldError} inputRef={questionRef} />
            <div>
              <Button variant="secondary" onClick={sendAnswer} loading={busy} loadingLabel="Reading…">
                Send answer
              </Button>
            </div>
          </div>
        ) : (
          <div className="state-actions">
            <Button variant="secondary" onClick={readDescription} loading={busy} loadingLabel="Reading…">
              Read my description
            </Button>
            {demoMode ? (
              <Button
                variant="quiet"
                onClick={() => {
                  setSentence(DEMO_EXAMPLE_SENTENCE);
                  setFieldError(undefined);
                }}
              >
                Use the example sentence
              </Button>
            ) : null}
          </div>
        )}

        {busy ? (
          <p role="status" className="field-hint">
            Reading your description
          </p>
        ) : null}

        {phase === "done" ? (
          <p className="note intake-note" data-tone="ok" role="note" tabIndex={-1} ref={noteRef} data-testid="intake-note">
            {note}
          </p>
        ) : null}

        {phase === "failed" ? (
          <ErrorState title="Could not read the description" message={failure} headingRef={failureRef} role="status" />
        ) : null}
      </div>
    </details>
  );
}
