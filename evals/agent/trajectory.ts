// Trajectory evals over every recorded intake trace: step count, clarifying questions, allowed tools, schema-valid
// final output, and no Qloo call outside the typed parameter set (ticket M3-03).
import { sanitizeInput } from "../../packages/agent/src/index";
import { Assertions, injectionString, loadAdversarial, loadGroundTruth, loadInjections, type CaseResult } from "./common";
import { loadTrace, replayTrace, trajectoryChecks } from "./harness";

interface Planned {
  readonly stem: string;
  readonly sentence: string;
  readonly clarified: boolean;
}

export function plannedTraces(): Planned[] {
  const out: Planned[] = loadGroundTruth().cases.map((c) => ({ stem: c.trace, sentence: c.sentence, clarified: c.clarified }));
  const inj = loadInjections();
  for (const c of inj.cases) {
    const sentence = inj.sentenceTemplate.replace("{value}", () => injectionString(c));
    if (sanitizeInput(sentence).ok) out.push({ stem: `inj-${c.id}`, sentence, clarified: false });
  }
  for (const c of loadAdversarial().cases) if (c.kind === "typed" || c.kind === "hostile_result") out.push({ stem: c.trace, sentence: c.sentence, clarified: false });
  return out;
}

export async function runTrajectories(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  for (const p of plannedTraces()) {
    const a = new Assertions();
    try {
      const trace = loadTrace(p.stem);
      const run = await replayTrace(trace, p.sentence, p.clarified);
      a.expect(run.outcome.status !== "deterministic", "the trace did not replay (sentence changed without re-recording?)");
      trajectoryChecks(a, trace, run.outcome, run.transport);
    } catch (e) {
      a.expect(false, `error: ${e instanceof Error ? e.message : "unknown"}`);
    }
    out.push(a.result("trajectory", p.stem));
  }
  return out;
}
