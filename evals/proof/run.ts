// Runner for the M3-04 proof. Usage:
//   npm run proof                  replay from fixtures/qloo/proof (offline, no key), write the two evidence files
//   npm run proof -- --json        replay and print the results as JSON (writes nothing)
//   npm run proof -- --live        ONE-TIME recording: live Qloo calls through the adapter, then the same as replay
//                                  (needs QLOO_API_KEY in the environment; the key is never printed or stored)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVIDENCE_DIR, loadRunLog, loadSets, replayClient, type LoadedSets, type RunLog } from "./common";
import { runFitSanity, type FitSanityResult } from "./fit-sanity";
import { runHomeCity, type HomeCityResult } from "./home-city";
import { renderFit, renderHomeCity } from "./report";
import type { QlooClient } from "../../packages/qloo/src/index";

export interface ProofOutput {
  readonly homeCity: HomeCityResult;
  readonly fitSanity: FitSanityResult;
  readonly digests: { readonly homeCitySet: string; readonly fitSet: string };
  readonly runLog: RunLog;
  readonly markdown: { readonly homeCity: string; readonly fitSanity: string };
}

export async function runProof(client: QlooClient, sets: LoadedSets, runLog: RunLog): Promise<ProofOutput> {
  const homeCity = await runHomeCity(client, sets.homeCity);
  const fitSanity = await runFitSanity(client, sets.fit);
  return {
    homeCity,
    fitSanity,
    digests: { homeCitySet: sets.homeCityDigest, fitSet: sets.fitDigest },
    runLog,
    markdown: { homeCity: renderHomeCity(homeCity, sets, runLog), fitSanity: renderFit(fitSanity, sets, runLog) },
  };
}

export const HOME_CITY_REPORT = join(EVIDENCE_DIR, "home-city-check.md");
export const FIT_REPORT = join(EVIDENCE_DIR, "fit-sanity.md");

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const sets = loadSets();
  let out: ProofOutput;
  if (args.has("--live")) {
    const { createRecorder } = await import("./record");
    const rec = createRecorder();
    // Recording pass: only the calls matter; the reports are rendered from the stored recordings in the replay pass.
    await runHomeCity(rec.client, sets.homeCity);
    await runFitSanity(rec.client, sets.fit);
    rec.finish();
    out = await runProof(replayClient(), sets, loadRunLog());
  } else {
    out = await runProof(replayClient(), sets, loadRunLog());
  }
  if (args.has("--json")) {
    const { markdown: _markdown, ...rest } = out;
    void _markdown;
    process.stdout.write(JSON.stringify(rest, null, 2) + "\n");
    return;
  }
  writeFileSync(HOME_CITY_REPORT, out.markdown.homeCity);
  writeFileSync(FIT_REPORT, out.markdown.fitSanity);
  const h = out.homeCity.summary;
  const f = out.fitSanity.summary;
  console.log(`home-city: ${h.hits} of ${h.measured} resolved acts (${h.listed} listed); enough-data reading ${h.hitsEnoughData} of ${h.measured}`);
  console.log(`fit-sanity: ${f.outranking} of ${f.comparable} same-genre candidates above their control (${f.crowdCount} crowds)`);
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : "proof failed");
    process.exit(1);
  });
}
