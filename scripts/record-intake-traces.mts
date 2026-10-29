/**
 * Records the intake traces in fixtures/agent/intake/ with a LIVE OpenAI key (M3-01). Run once:
 *   node --env-file=.env --import tsx scripts/record-intake-traces.mts
 * Qloo is NOT called: `propose_matches` runs against the recorded fixtures (FixtureTransport).
 * The files hold the sentence, the model turns as returned and the outcome. No key or header is written.
 * Prints tokens and USD per call and in total (from the API `usage`).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createQlooClient, FixtureTransport, InMemoryCacheStore } from "@headliner/qloo";
import { completeJson, createOpenAiProvider, DEFAULT_LLM_MODEL, runIntake, type LlmProvider, type LlmTurn } from "../packages/agent/src";
import { z } from "zod";

const key = process.env["OPENAI_API_KEY"];
if (!key) throw new Error("OPENAI_API_KEY is not set");
const model = process.env["LLM_MODEL"] || DEFAULT_LLM_MODEL;
const outDir = resolve(import.meta.dirname, "../fixtures/agent/intake");
mkdirSync(outDir, { recursive: true });

let totalCost = 0;
let totalTokens = 0;
const base = createOpenAiProvider({ apiKey: key, model });

const CASES: { slug: string; input: string; clarified: boolean }[] = [
  { slug: "leipzig-khruangbin-bonobo", input: "200-cap venue in Leipzig, our regulars love Khruangbin and Bonobo", clarified: false },
  {
    slug: "berlin-full-room",
    input:
      "We are a 350-cap room in Berlin. Our crowd follows Apparat, Moderat, Modeselektor, Hundreds, Brandt Brauer Frick and Boys Noize. We are thinking of booking Khruangbin, Radiohead and Reality Club, and we also want to compare London and Tromso.",
    clarified: false,
  },
  { slug: "underspecified-asks-once", input: "We run a small venue and want to book some bands.", clarified: false },
  {
    slug: "clarified-reykjavik",
    input: "We run a small venue and want to book some bands. Answer: it is in Reykjavik, our crowd likes Sigur Ros and Bjork, we are considering Radiohead and Phoenix.",
    clarified: true,
  },
];

if (process.argv.includes("--smoke")) {
  const r = await completeJson(base, {
    messages: [{ role: "user", content: 'Reply with JSON {"city": "Leipzig"}.' }],
    name: "smoke",
    schema: z.object({ city: z.string() }).strict(),
    maxCompletionTokens: 300,
  });
  console.log("smoke", r.ok, r.turn.usage, r.turn.costUsd);
  process.exit(0);
}

for (const c of CASES) {
  const turns: LlmTurn[] = [];
  const recording: LlmProvider = {
    model: base.model,
    async complete(req) {
      const t = await base.complete(req);
      turns.push(t);
      totalCost += t.costUsd;
      totalTokens += t.usage.totalTokens;
      return t;
    },
  };
  const qloo = createQlooClient({ transport: new FixtureTransport(resolve(import.meta.dirname, "../fixtures/qloo")), cache: new InMemoryCacheStore() });
  const outcome = await runIntake(c.input, { provider: recording, qloo, clarified: c.clarified });
  const trace = { input: c.input, clarified: c.clarified, model, recordedAt: new Date().toISOString(), turns, outcome };
  writeFileSync(resolve(outDir, `${c.slug}.json`), `${JSON.stringify(trace, null, 2)}\n`);
  console.log(c.slug, outcome.status, `turns=${turns.length}`);
}
console.log(`TOTAL tokens=${totalTokens} costUsd=${totalCost.toFixed(6)}`);
