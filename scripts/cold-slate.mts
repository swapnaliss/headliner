// Cold-slate timing over the Qloo adapter (M1-01). Usage:
//   node --env-file=<env file holding the hackathon key> node_modules/tsx/dist/cli.mjs scripts/cold-slate.mts
// Resolves a 6-act crowd and 12 candidates (18 searches) and runs one list compare per candidate
// (12 compares): 30 live calls through createQlooClient with an empty in-memory cache, concurrency 6.
// This is the Qloo-side wall time of a 6x12 slate. It excludes scoring (microseconds), the HTTP route
// and any LLM step. The key is read from the environment by liveTransportFromEnv and never printed.
import { createQlooClient, InMemoryCacheStore, liveTransportFromEnv } from "../packages/qloo/src/index";

const CROWD = ["Apparat", "Moderat", "Modeselektor", "Boys Noize", "Brandt Brauer Frick", "Hundreds"];
const CANDIDATES = [
  "Khruangbin", "Radiohead", "Reality Club", "Amaarae", "Hindia", "Odunsi (The Engine)",
  "Phoenix", "Sigur Rós", "Björk", "Bonobo", "Four Tet", "Floating Points",
];

const events: Record<string, number> = {};
const client = createQlooClient({
  transport: liveTransportFromEnv(),
  cache: new InMemoryCacheStore(),
  onEvent: (e) => {
    const k = e.type === "live_call" ? `live_call_${e.status}` : e.type === "retry" ? `retry_${e.kind}` : e.type;
    events[k] = (events[k] ?? 0) + 1;
  },
});
const t0 = performance.now();

const names = [...CROWD, ...CANDIDATES];
const resolved = await Promise.all(names.map((n) => client.search(n)));
const tSearch = performance.now();
const ids = resolved.map((r) => r.data[0]?.entityId);
if (ids.some((i) => !i)) throw new Error("an act did not resolve");
const crowdIds = ids.slice(0, CROWD.length) as string[];
const candIds = ids.slice(CROWD.length) as string[];

const compares = await Promise.all(candIds.map((id) => client.compareAudiences(crowdIds, [id])));
const t1 = performance.now();

const s = client.stats();
const out = {
  measuredAt: new Date().toISOString(),
  scope: "Qloo adapter only: 18 searches then 12 list compares, empty cache, concurrency 6; no scoring, route or LLM",
  liveCalls: s.liveCalls,
  events,
  searchPhaseMs: Math.round(tSearch - t0),
  comparePhaseMs: Math.round(t1 - tSearch),
  totalMs: Math.round(t1 - t0),
  compareTagCounts: compares.map((c) => c.data.length),
};
console.log(JSON.stringify(out, null, 2));
