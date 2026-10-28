// Ground-truth evals: each sentence replays its recorded trace through the real `runIntake` and the result is
// compared with the expected Room. Every recorded trace (ground truth, injections, adversarial) also gets the
// trajectory checks. No key, no network.
import type { IntakeOutcome } from "../../packages/agent/src/index";
import { Assertions, loadGroundTruth, type CaseResult, type GroundTruthCase } from "./common";
import { loadTrace, replayTrace } from "./harness";

const fold = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
/** `got` equals `want` as sets of names; a wanted name `A|B` accepts either spelling. */
const sameSet = (got: readonly string[], want: readonly string[]): boolean => {
  if (got.length !== want.length) return false;
  const left = new Set(got.map(fold));
  return want.every((w) => w.split("|").some((alt) => left.delete(fold(alt))));
};

export function compareOutcome(a: Assertions, expect: GroundTruthCase["expect"], outcome: IntakeOutcome): void {
  a.expect(outcome.status === expect.status, `status is ${outcome.status}, expected ${expect.status}`);
  if (outcome.status !== expect.status) return;
  if (expect.status === "room" && outcome.status === "room") {
    a.expect(fold(outcome.room.city) === fold(expect.city), `city is ${outcome.room.city}, expected ${expect.city}`);
    a.expect(sameSet(outcome.room.crowdActs, expect.crowdActs), `crowd acts are [${outcome.room.crowdActs.join(", ")}]`);
    a.expect(sameSet(outcome.room.candidateActs, expect.candidateActs), `candidate acts are [${outcome.room.candidateActs.join(", ")}]`);
    a.expect(sameSet(outcome.cities, expect.cities), `compared cities are [${outcome.cities.join(", ")}]`);
  }
  if (expect.status === "intake_failed" && outcome.status === "intake_failed") a.expect(outcome.reason === expect.reason, `failure reason is ${outcome.reason}`);
  if (expect.status === "clarification" && outcome.status === "clarification") a.expect((outcome.clarification ?? "").length > 0, "clarification has no question");
}

export async function runGroundTruth(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  for (const c of loadGroundTruth().cases) {
    const a = new Assertions();
    try {
      const trace = loadTrace(c.trace);
      a.expect(trace.input === c.sentence, "the recorded sentence differs from the ground-truth sentence (re-record)");
      const run = await replayTrace(trace, c.sentence, c.clarified);
      a.expect(run.outcome.status !== "deterministic", `replay was deterministic (${run.outcome.status === "deterministic" ? run.outcome.reason : ""}); the trace does not match`);
      compareOutcome(a, c.expect, run.outcome);
    } catch (e) {
      a.expect(false, `error: ${e instanceof Error ? e.message : "unknown"}`);
    }
    out.push(a.result("groundTruth", c.id));
  }
  return out;
}
