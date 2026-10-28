// MANUAL, LIVE recording of the agent traces (needs OPENAI_API_KEY; CI never runs this):
//   npm run eval:agent:record                 records every case whose trace file is missing
//   npm run eval:agent:record -- --force      re-records everything
//   npm run eval:agent:record -- --only adv-  records the cases whose trace name starts with the prefix
// Qloo is NOT called: tools run against the eval transport (recorded fixtures, else empty results), the same
// transport the replay uses. Files hold the sentence, the model turns as returned and the outcome; no key or
// header is written. Prints tokens and USD per call and in total, from the API `usage`, and stops at a hard cap.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { explainSlate, createOpenAiProvider, DEFAULT_LLM_MODEL, runIntake, sanitizeInput, type LlmProvider, type LlmTurn } from "../../packages/agent/src/index";
import { loadSlate, withActName } from "../../packages/agent/src/explain/testkit";
import { explainModelFrom } from "../../apps/web/src/explainModel";
import { EVAL_TRACES, EXPLAIN_REPLIES, INTAKE_TRACES, RECORDINGS_MANIFEST, evalClient, evalTransport, injectionString, loadAdversarial, loadGroundTruth, loadInjections, ROOT } from "./common";
import { hostileSearchScript } from "./harness";

const HARD_CAP_USD = 0.1;
const key = process.env["OPENAI_API_KEY"];
if (!key) throw new Error("OPENAI_API_KEY is not set (this command is live and manual; CI replays the committed traces)");
const model = process.env["LLM_MODEL"] || DEFAULT_LLM_MODEL;
const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.includes("--only") ? (args[args.indexOf("--only") + 1] ?? "") : "";
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();

mkdirSync(EVAL_TRACES, { recursive: true });
mkdirSync(EXPLAIN_REPLIES, { recursive: true });

interface ManifestEntry {
  file: string;
  recordedAt: string;
  commit: string;
  model: string;
  turns: number;
  tokens: number;
  costUsd: number;
}
const manifest: Record<string, ManifestEntry> = existsSync(RECORDINGS_MANIFEST) ? (JSON.parse(readFileSync(RECORDINGS_MANIFEST, "utf8")) as { entries: Record<string, ManifestEntry> }).entries : {};

let totalCost = 0;
let totalTokens = 0;
const base: LlmProvider = createOpenAiProvider({ apiKey: key, model });

function wanted(stem: string, dir: string): boolean {
  if (only && !stem.startsWith(only)) return false;
  if (!force && (existsSync(join(dir, `${stem}.json`)) || (dir === EVAL_TRACES && existsSync(join(INTAKE_TRACES, `${stem}.json`))))) return false;
  return true;
}

function recorder(turns: LlmTurn[]): LlmProvider {
  return {
    model: base.model,
    async complete(req) {
      if (totalCost > HARD_CAP_USD) throw new Error("hard spend cap reached");
      const t = await base.complete(req);
      turns.push(t);
      totalCost += t.costUsd;
      totalTokens += t.usage.totalTokens;
      return t;
    },
  };
}

async function recordIntake(stem: string, sentence: string, clarified: boolean, script?: ReturnType<typeof hostileSearchScript>): Promise<void> {
  if (!wanted(stem, EVAL_TRACES)) return;
  const turns: LlmTurn[] = [];
  const transport = evalTransport(script);
  const outcome = await runIntake(sentence, { provider: recorder(turns), qloo: evalClient(transport), clarified });
  const recordedAt = new Date().toISOString();
  writeFileSync(join(EVAL_TRACES, `${stem}.json`), `${JSON.stringify({ input: sentence, clarified, model, recordedAt, turns, outcome }, null, 2)}\n`);
  manifest[stem] = { file: `fixtures/agent/evals/intake/${stem}.json`, recordedAt, commit, model, turns: turns.length, tokens: turns.reduce((n, t) => n + t.usage.totalTokens, 0), costUsd: turns.reduce((n, t) => n + t.costUsd, 0) };
  console.log(stem.padEnd(34), outcome.status, `turns=${turns.length}`);
}

async function main(): Promise<void> {
  for (const c of loadGroundTruth().cases) await recordIntake(c.trace, c.sentence, c.clarified);

  const inj = loadInjections();
  for (const c of inj.cases) {
    const sentence = inj.sentenceTemplate.replace("{value}", () => injectionString(c));
    if (sanitizeInput(sentence).ok) await recordIntake(`inj-${c.id}`, sentence, false);
  }

  for (const c of loadAdversarial().cases) {
    if (c.kind === "typed") await recordIntake(c.trace, c.sentence, false);
    else if (c.kind === "hostile_result") await recordIntake(c.trace, c.sentence, false, hostileSearchScript(c.query, c.hostileName));
    else if (c.kind === "hostile_slate") {
      if (!wanted(c.reply, EXPLAIN_REPLIES)) continue;
      const slate = withActName(loadSlate("sample-leipzig-indie"), 0, c.actName);
      const turns: LlmTurn[] = [];
      const result = await explainSlate(slate, { model: explainModelFrom(recorder(turns)), timeoutMs: 30_000 });
      const t = turns[0];
      if (!t) throw new Error("the explanation made no model call");
      const recordedAt = new Date().toISOString();
      // The raw reply text as the model produced it (the structured-output JSON), plus what the pipeline did with it.
      writeFileSync(join(EXPLAIN_REPLIES, `${c.reply}.json`), `${JSON.stringify({ actName: c.actName, model, recordedAt, text: t.content ?? "", usage: t.usage, costUsd: t.costUsd, pipelineSource: result.source }, null, 2)}\n`);
      manifest[c.reply] = { file: `fixtures/agent/evals/explain/${c.reply}.json`, recordedAt, commit, model, turns: 1, tokens: t.usage.totalTokens, costUsd: t.costUsd };
      console.log(c.reply.padEnd(34), result.source, result.fallback ?? "");
    }
  }

  writeFileSync(RECORDINGS_MANIFEST, `${JSON.stringify({ note: "Written by npm run eval:agent:record. `commit` is the commit the recording ran on top of.", entries: Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))) }, null, 2)}\n`);
  console.log(`TOTAL tokens=${totalTokens} costUsd=${totalCost.toFixed(6)} model=${model}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "recording failed");
  process.exit(1);
});
