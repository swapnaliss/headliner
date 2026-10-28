// Runner for the M3-03 agent evals. Replay only: no key, no network, DEMO_MODE=fixtures or not.
//   npm run eval:agent                         run every category, print a summary, write docs/evidence/agent-evals.md
//   npm run --silent eval:agent -- --json      print the results as JSON on stdout and nothing else (writes nothing)
//   npm run eval:agent -- --out report.json    write the JSON to a file (the npm banner cannot get into it), also print the summary
// `npm run` prints a "> headliner@... eval:agent" banner on stdout; use `npm run --silent` (or `--out`) whenever the output is parsed.
// Exit code 1 when any case fails. The live recording is a separate manual command: `npm run eval:agent:record`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runAdversarial } from "./adversarial";
import { REPORT_PATH, type CaseResult } from "./common";
import { runToolFailures } from "./failures";
import { runGroundTruth } from "./ground-truth";
import { runInjections } from "./injections";
import { knownGaps, loadRecordingFacts, renderReport } from "./report";
import { runTrajectories } from "./trajectory";

export interface EvalOutput {
  readonly groundTruth: number;
  readonly injections: number;
  readonly toolFailures: number;
  readonly adversarial: number;
  readonly trajectories: number;
  readonly passed: number;
  readonly failed: number;
  readonly cases: readonly CaseResult[];
}

export async function runAll(): Promise<EvalOutput> {
  const groundTruth = await runGroundTruth();
  const trajectories = await runTrajectories();
  const injections = await runInjections();
  const toolFailures = await runToolFailures();
  const adversarial = await runAdversarial();
  const cases = [...groundTruth, ...trajectories, ...injections, ...toolFailures, ...adversarial];
  return {
    groundTruth: groundTruth.length,
    injections: injections.length,
    toolFailures: toolFailures.length,
    adversarial: adversarial.length,
    trajectories: trajectories.length,
    passed: cases.filter((c) => c.ok).length,
    failed: cases.filter((c) => !c.ok).length,
    cases,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const out = await runAll();
  const json = `${JSON.stringify(out, null, 2)}\n`;
  if (args.includes("--json")) {
    process.stdout.write(json);
    process.exit(out.failed === 0 ? 0 : 1);
  }
  const outIndex = args.indexOf("--out");
  if (outIndex >= 0) {
    const path = args[outIndex + 1];
    if (!path) throw new Error("--out needs a file path");
    writeFileSync(path, json);
  }
  writeFileSync(REPORT_PATH, renderReport(out, loadRecordingFacts(), await knownGaps()));
  for (const c of out.cases.filter((x) => !x.ok)) console.log(`FAIL ${c.category}/${c.id}: ${c.failures.join("; ")}`);
  console.log(`ground truth: ${out.groundTruth} cases, trajectories: ${out.trajectories}, injections: ${out.injections}, tool failures: ${out.toolFailures}, adversarial: ${out.adversarial}`);
  console.log(`${out.passed} passed, ${out.failed} failed (${out.cases.reduce((n, c) => n + c.checks, 0)} assertions)`);
  process.exit(out.failed === 0 ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : "agent evals failed");
    process.exit(1);
  });
}
