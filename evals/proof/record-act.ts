// One-act supplementary recording for the home-city check (M3-04 follow-up). Usage (needs QLOO_API_KEY in the env):
//   node --env-file-if-exists=.env --import tsx evals/proof/record-act.ts "Rich Brian" run-log-2026-10-28.json
// The act must be in home-city-set.json. Its entity comes from the already recorded search (replay, no live call);
// only the heatmap for every city of the set goes live, through the same recorder as `npm run proof -- --live`.
// Existing fixtures are never rewritten, and the original run-log.json is left alone (the log goes to the named file).
import { join } from "node:path";
import { fetchHeatmap } from "../../packages/qloo/src/index";
import { FIXTURE_DIR, loadSets, replayClient, resolveName } from "./common";
import { createRecorder } from "./record";

async function main(): Promise<void> {
  const [name, logFile] = process.argv.slice(2);
  if (!name || !logFile || !/^run-log[\w.-]*\.json$/.test(logFile)) throw new Error("usage: record-act.ts <act name> <run-log-*.json>");
  const set = loadSets().homeCity;
  const act = set.acts.find((a) => a.name === name);
  if (!act) throw new Error("act is not in the pre-registered set");
  const res = await resolveName(replayClient(), act.name);
  if (res.status !== "resolved") throw new Error(`act does not resolve from the recorded search: ${res.reason}`);
  const rec = createRecorder(join(FIXTURE_DIR, logFile));
  for (const city of set.cities) {
    const out = await fetchHeatmap(rec.client, { entityId: res.entityId, city });
    process.stdout.write(`${city}: ${out.status}\n`);
  }
  const log = rec.finish();
  process.stdout.write(JSON.stringify(log) + "\n");
}

void main();
