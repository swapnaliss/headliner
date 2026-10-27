// Qloo recorder (M0-02). Usage: node scripts/qloo-record.ts <stage>   (also runs under `npx tsx`)
// Stages: search | insights | compare | heatmap | heatmap-m2 | heatmap-extra | trending | invalid | burst | index | all
// The key is read ONLY from the QLOO_API_KEY environment variable (loaded by the shell). It is sent as a
// request header and is never printed, never written to a file, and request headers are never recorded.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://hackathon.api.qloo.com";
const TIMEOUT_MS = 30_000;
const FIX = "fixtures/qloo";
const EVIDENCE = "docs/evidence";

type ParamValue = string | number;
type Params = Record<string, ParamValue>;

interface Fixture {
  endpoint: string;
  params: Record<string, string>;
  status: number;
  recordedAt: string;
  latencyMs: number;
  body: unknown;
}

const key = process.env.QLOO_API_KEY;

function toSearchParams(params: Params): URLSearchParams {
  const sp = new URLSearchParams();
  for (const k of Object.keys(params).sort()) sp.set(k, String(params[k]));
  return sp;
}

// Only these response headers are ever recorded (names and values of non-secret headers).
const HEADER_ALLOW = /^(retry-after|x-ratelimit.*|ratelimit.*|x-rate-limit.*|content-type|content-length|date|server|via|age|x-cache|cache-control)$/i;

interface RawResult {
  status: number;
  latencyMs: number;
  bytes: number;
  body: unknown;
  headers: Record<string, string>;
}

async function rawGet(path: string, params: Params): Promise<RawResult> {
  if (!key) throw new Error("QLOO_API_KEY is not set in the environment");
  const url = `${BASE}${path}?${toSearchParams(params).toString()}`;
  const t0 = performance.now();
  const res = await fetch(url, {
    headers: { "X-Api-Key": key, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  const latencyMs = Math.round(performance.now() - t0);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { nonJsonBody: text.slice(0, 500) };
  }
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    if (HEADER_ALLOW.test(k)) headers[k] = v;
  });
  return { status: res.status, latencyMs, bytes: Buffer.byteLength(text), body, headers };
}

function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

mkdirSync(FIX, { recursive: true });
mkdirSync(EVIDENCE, { recursive: true });

let calls = 0;
const callLog: { file: string; status: number; latencyMs: number; bytes: number }[] = [];

async function record(prefix: string, name: string, path: string, params: Params): Promise<Fixture> {
  const r = await rawGet(path, params);
  calls += 1;
  const file = `${prefix}--${slug(name)}.json`;
  const fx: Fixture = {
    endpoint: path,
    params: Object.fromEntries(toSearchParams(params).entries()),
    status: r.status,
    recordedAt: new Date().toISOString(),
    latencyMs: r.latencyMs,
    body: r.body,
  };
  writeFileSync(join(FIX, file), JSON.stringify(fx, null, 2) + "\n");
  callLog.push({ file, status: r.status, latencyMs: r.latencyMs, bytes: r.bytes });
  console.log(`${r.status} ${String(r.latencyMs).padStart(5)}ms ${String(r.bytes).padStart(7)}B ${file}`);
  if (r.status === 429 || r.status >= 500) {
    console.log(`stopping: ${r.status} headers=${JSON.stringify(r.headers)}`);
    flushLog();
    process.exit(2);
  }
  return fx;
}

function flushLog(): void {
  const p = join(EVIDENCE, "qloo-calls.json");
  const prev: unknown = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : [];
  const all = [...(Array.isArray(prev) ? prev : []), ...callLog.map((c) => ({ ...c, at: new Date().toISOString() }))];
  writeFileSync(p, JSON.stringify(all, null, 2) + "\n");
  callLog.length = 0;
}

function load(file: string): Fixture {
  return JSON.parse(readFileSync(join(FIX, file), "utf8")) as Fixture;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function searchResults(fx: Fixture): Record<string, unknown>[] {
  const b = fx.body;
  if (!isObj(b)) return [];
  const r = b.results;
  return Array.isArray(r) ? r.filter(isObj) : [];
}

function idFor(name: string): string {
  const rs = searchResults(load(`search--${slug(name)}.json`));
  const first = rs[0];
  const id = first && (first.entity_id ?? first.id);
  if (typeof id !== "string") throw new Error(`no entity id for ${name}`);
  return id;
}

const CROWD = ["Apparat", "Moderat", "Modeselektor", "Hundreds", "Brandt Brauer Frick", "Boys Noize"];
const CANDIDATES = ["Khruangbin", "Radiohead", "Reality Club", "Hindia", "Odunsi (The Engine)", "Amaarae"];
const SEARCH_EXTRA = ["Phoenix", "Sigur Rós", "Björk", "Zzqxv Nonexistentact 9731"];
const ARTIST = "urn:entity:artist";

async function stageSearch(): Promise<void> {
  for (const n of [...CROWD, ...CANDIDATES, ...SEARCH_EXTRA]) {
    await record("search", n, "/search", { query: n, types: ARTIST, take: 5 });
  }
}

async function stageInsights(): Promise<void> {
  for (const n of CROWD.slice(0, 3)) {
    await record("insights", n, "/v2/insights", {
      "filter.type": ARTIST,
      "signal.interests.entities": idFor(n),
      take: 10,
    });
  }
}

async function stageCompare(): Promise<void> {
  const crowdIds = CROWD.map(idFor);
  const cand = (n: string): string => idFor(n);
  // single crowd entity vs one candidate (per-act plan building block)
  await record("compare", "single-apparat-vs-khruangbin", "/v2/insights/compare", {
    "a.signal.interests.entities": crowdIds[0] ?? "",
    "b.signal.interests.entities": cand("Khruangbin"),
    "filter.type": ARTIST,
  });
  // list compare: all six crowd entities (comma-separated) vs one candidate
  for (const n of ["Khruangbin", "Radiohead", "Reality Club"]) {
    await record("compare", `list6-crowd-vs-${n}`, "/v2/insights/compare", {
      "a.signal.interests.entities": crowdIds.join(","),
      "b.signal.interests.entities": cand(n),
      "filter.type": ARTIST,
    });
  }
  // list on both sides
  await record("compare", "list6-crowd-vs-list2-cands", "/v2/insights/compare", {
    "a.signal.interests.entities": crowdIds.join(","),
    "b.signal.interests.entities": [cand("Khruangbin"), cand("Radiohead")].join(","),
    "filter.type": ARTIST,
  });
}

const CITIES = ["Berlin", "Leipzig", "Lagos", "Jakarta", "Mumbai", "London", "Reykjavik", "Tromsø"];

async function stageHeatmap(): Promise<void> {
  const a = idFor("Apparat");
  for (const c of CITIES) {
    await record("heatmap", `apparat-${c}`, "/v2/insights", {
      "filter.type": "urn:heatmap",
      "filter.location.query": c,
      "signal.interests.entities": a,
    });
  }
  await record("heatmap", "reality-club-Jakarta", "/v2/insights", {
    "filter.type": "urn:heatmap",
    "filter.location.query": "Jakarta",
    "signal.interests.entities": idFor("Reality Club"),
  });
  await record("heatmap", "odunsi-the-engine-Lagos", "/v2/insights", {
    "filter.type": "urn:heatmap",
    "filter.location.query": "Lagos",
    "signal.interests.entities": idFor("Odunsi (The Engine)"),
  });
}

// M2-03: heatmaps of the sample-room candidates in the cities the act-detail strip compares.
const M2_CITIES = ["Berlin", "London", "Leipzig", "Jakarta"];
const M2_CANDIDATES = ["Khruangbin", "Radiohead", "Reality Club"];

async function stageHeatmapM2(): Promise<void> {
  for (const n of M2_CANDIDATES) {
    for (const c of M2_CITIES) {
      if (existsSync(join(FIX, `heatmap--${slug(`${n}-${c}`)}.json`))) continue;
      await record("heatmap", `${n}-${c}`, "/v2/insights", {
        "filter.type": "urn:heatmap",
        "filter.location.query": c,
        "signal.interests.entities": idFor(n),
      });
    }
  }
}

// Probe extra "Name|City" pairs given on the command line (used to find a city with no heatmap cells).
async function stageHeatmapExtra(): Promise<void> {
  for (const pair of process.argv.slice(3)) {
    const [n, c] = pair.split("|");
    if (!n || !c) continue;
    await record("heatmap", `${n}-${c}`, "/v2/insights", {
      "filter.type": "urn:heatmap",
      "filter.location.query": c,
      "signal.interests.entities": idFor(n),
    });
  }
}

async function stageTrending(): Promise<void> {
  await record("trending", "artist-no-signal", "/v2/trending", {
    "filter.type": ARTIST,
    "filter.start_date": "2026-07-24",
    "filter.end_date": "2026-10-24",
    take: 10,
  });
  await record("trending", "artist-signal-apparat", "/v2/trending", {
    "filter.type": ARTIST,
    "signal.interests.entities": idFor("Apparat"),
    "filter.start_date": "2026-07-24",
    "filter.end_date": "2026-10-24",
    take: 10,
  });
}

async function stageInvalid(): Promise<void> {
  await record("invalid", "bogus-parameter", "/v2/insights", {
    "filter.type": ARTIST,
    "signal.interests.entities": idFor("Apparat"),
    take: 5,
    "bogus.parameter": "definitely-not-real",
  });
}

// Burst probe: at most 40 calls total, concurrency 1 then 6, stops at the first 429 or 5xx.
// Distinct URLs (varying `take` and entity) so server-side response caching does not mask latency.
async function stageBurst(): Promise<void> {
  const ids = [...CROWD, ...CANDIDATES].map(idFor);
  const mk = (i: number): Params => ({
    "filter.type": ARTIST,
    "signal.interests.entities": ids[i % ids.length] ?? "",
    take: 6 + (i % 7),
  });
  const out: { phase: string; i: number; status: number; latencyMs: number; headers: Record<string, string> }[] = [];
  let stop = false;
  const one = async (phase: string, i: number): Promise<void> => {
    if (stop) return;
    const r = await rawGet("/v2/insights", mk(100 + i));
    calls += 1;
    out.push({ phase, i, status: r.status, latencyMs: r.latencyMs, headers: r.headers });
    if (r.status === 429 || r.status >= 500) stop = true;
  };
  const t1 = performance.now();
  for (let i = 0; i < 20 && !stop; i++) await one("c1", i);
  const wall1 = Math.round(performance.now() - t1);
  const t2 = performance.now();
  for (let b = 0; b < 20 && !stop; b += 6) {
    const batch = Array.from({ length: Math.min(6, 20 - b) }, (_, k) => 20 + b + k);
    await Promise.all(batch.map((i) => one("c6", i)));
  }
  const wall6 = Math.round(performance.now() - t2);
  writeFileSync(
    join(EVIDENCE, "qloo-burst.json"),
    JSON.stringify({ calls: out.length, stoppedEarly: stop, wallMsConcurrency1: wall1, wallMsConcurrency6: wall6, results: out }, null, 2) + "\n",
  );
  console.log(`burst calls=${out.length} stopped=${stop} wall c1=${wall1}ms c6=${wall6}ms statuses=${[...new Set(out.map((o) => o.status))].join(",")}`);
}

function stageIndex(): void {
  const index: Record<string, string> = {};
  for (const f of readdirSync(FIX).filter((x) => x.endsWith(".json") && x !== "index.json").sort()) {
    const fx = load(f);
    const sp = new URLSearchParams(Object.entries(fx.params).sort(([a], [b]) => (a < b ? -1 : 1)));
    index[`${fx.endpoint}?${sp.toString()}`] = f;
  }
  writeFileSync(join(FIX, "index.json"), JSON.stringify(index, null, 2) + "\n");
  console.log(`index: ${Object.keys(index).length} entries`);
}

const stages: Record<string, () => Promise<void> | void> = {
  search: stageSearch,
  insights: stageInsights,
  compare: stageCompare,
  heatmap: stageHeatmap,
  "heatmap-m2": stageHeatmapM2,
  "heatmap-extra": stageHeatmapExtra,
  trending: stageTrending,
  invalid: stageInvalid,
  burst: stageBurst,
  index: stageIndex,
};

const arg = process.argv[2] ?? "";
const order = arg === "all" ? ["search", "insights", "compare", "heatmap", "trending", "invalid", "index"] : [arg];
for (const s of order) {
  const fn = stages[s];
  if (!fn) {
    console.error(`unknown stage "${s}"`);
    process.exit(1);
  }
  await fn();
}
flushLog();
console.log(`live calls this run: ${calls}`);
