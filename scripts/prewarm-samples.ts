// Pre-warm the sample rooms (M2-06). Usage (from the repo root):
//   npx tsx scripts/prewarm-samples.ts --dry-run
//       Validates apps/web/samples/rooms.json and rebuilds every room from fixtures/qloo. No key,
//       no network, no database: it proves the recordings cover the rooms.
//   node --env-file=<env file> node_modules/tsx/dist/cli.mjs scripts/prewarm-samples.ts --record-fixtures
//       Runs each room through the production adapter against live Qloo (QLOO_API_KEY) and records
//       any response fixtures/qloo does not have yet. In-memory cache, no database.
//   node --env-file=<env file> node_modules/tsx/dist/cli.mjs scripts/prewarm-samples.ts --write-db
//       Same live run, but stores each Slate pinned in Postgres (DATABASE_URL, id `sample-<slug>`)
//       and the Qloo cache rows with a ten-year life. Flags combine.
// The key and the connection string are read from the environment by the adapter and the database
// client. This script never prints, logs or writes either, and never records a request header.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createQlooClient,
  FixtureTransport,
  InMemoryCacheStore,
  liveTransportFromEnv,
  PostgresCacheStore,
  type CacheStore,
  type QlooEvent,
  type QlooTransport,
  type TransportRequest,
  type TransportResponse,
} from "@headliner/qloo";
import { closeDb, getDb, putPinnedSlate } from "@headliner/slates";
import { buildSampleSlate, loadSampleRooms, sampleId, type SampleRoom } from "../apps/web/src/samples";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(ROOT, "fixtures", "qloo");
const ROOMS_FILE = join(ROOT, "apps", "web", "samples", "rooms.json");
/** Pinned cache rows live this long (the "pinned" rule for qloo_cache: a TTL cleanup never reaches them). */
const PINNED_TTL_SECONDS = 10 * 365 * 86_400;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const recordFixtures = args.has("--record-fixtures");
const writeDb = args.has("--write-db");

function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 50);
}

function keyOf(endpoint: string, params: URLSearchParams): string {
  const sorted = new URLSearchParams([...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return `${endpoint}?${sorted.toString()}`;
}

/** Wraps the live transport and writes any 200 response that has no recording yet into fixtures/qloo. */
class RecordingTransport implements QlooTransport {
  readonly recorded: string[] = [];
  private readonly index: Record<string, string>;
  constructor(private readonly inner: QlooTransport) {
    this.index = JSON.parse(readFileSync(join(FIXTURES, "index.json"), "utf8")) as Record<string, string>;
  }
  async get(req: TransportRequest): Promise<TransportResponse> {
    const started = Date.now();
    const res = await this.inner.get(req);
    const key = keyOf(req.endpoint, req.params);
    if (res.status === 200 && res.body !== undefined && !(key in this.index)) {
      const query = req.params.get("query");
      const stem = req.endpoint === "/search" && query ? `search--${slugify(query)}` : `${req.endpoint.includes("compare") ? "compare" : "heatmap"}--sample-${createHash("sha256").update(key).digest("hex").slice(0, 10)}`;
      const file = `${stem}.json`;
      const fixture = {
        endpoint: req.endpoint,
        params: Object.fromEntries([...req.params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
        status: res.status,
        recordedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        body: res.body,
      };
      writeFileSync(join(FIXTURES, file), JSON.stringify(fixture, null, 2) + "\n");
      this.index[key] = file;
      writeFileSync(join(FIXTURES, "index.json"), JSON.stringify(this.index, null, 2) + "\n");
      this.recorded.push(file);
    }
    return res;
  }
}

/**
 * Reads come from memory only, so every call really goes upstream (a Postgres hit would skip the
 * recorder and leave a gap in fixtures/qloo); writes go to both, so the pinned Postgres cache is filled.
 */
class WriteThroughCache implements CacheStore {
  private readonly memory = new InMemoryCacheStore();
  constructor(private readonly durable: CacheStore) {}
  get(key: string, now: Date) {
    return this.memory.get(key, now);
  }
  getStale(key: string) {
    return this.memory.getStale(key);
  }
  async put(key: string, entry: Parameters<CacheStore["put"]>[1], ttlSeconds: number, now: Date): Promise<void> {
    await this.memory.put(key, entry, ttlSeconds, now);
    await this.durable.put(key, entry, ttlSeconds, now);
  }
}

/** One line per list, so the file stays readable and diffs stay small. */
function formatRooms(rooms: readonly SampleRoom[]): string {
  const body = rooms.map((r) => `  {\n${Object.entries(r).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n")}\n  }`);
  return `[\n${body.join(",\n")}\n]\n`;
}

function describe(room: SampleRoom): string {
  return `${room.slug}: ${room.city}, ${room.crowdActs.length} crowd acts, ${room.candidateActs.length} candidates`;
}

async function dry(rooms: readonly SampleRoom[]): Promise<void> {
  console.log(`rooms.json valid: ${rooms.length} rooms`);
  for (const room of rooms) {
    // The same builder and the same fixtures a no-key server uses; a gap in the recordings throws.
    const recordedAt = new Date(`${room.recordedOn}T12:00:00.000Z`);
    const client = createQlooClient({ transport: new FixtureTransport(FIXTURES), cache: new InMemoryCacheStore(), now: () => recordedAt });
    const { slate, topActId } = await buildSampleSlate(room, client, "fixtures", () => recordedAt);
    const top = slate.results[0];
    console.log(slate.results.map((r) => `${r.rank}. ${r.act.name} fit ${r.fit?.value ?? "-"}`).join("; "));
    console.log(`cities for ${top?.act.name ?? "?"}: ${(top?.cityStrengths ?? []).map((c) => `${c.city} ${c.meanAffinityRank} (${c.cellCount} cells)`).join("; ")}`);
    console.log(`${describe(room)} -> ${sampleId(room.slug)}: ${slate.results.length} acts scored, top ${top?.act.name ?? "?"} (${topActId.slice(0, 8)}), ${top?.cityStrengths.length ?? 0} cities, ${client.stats().liveCalls} replayed calls`);
  }
  console.log("dry run ok: no network, no database");
}

async function live(rooms: readonly SampleRoom[]): Promise<void> {
  const events: Record<string, number> = {};
  const onEvent = (e: QlooEvent): void => {
    const k = e.type === "live_call" ? `live_call_${e.status}` : e.type === "retry" ? `retry_${e.kind}` : e.type;
    events[k] = (events[k] ?? 0) + 1;
  };
  const base = liveTransportFromEnv();
  const transport = recordFixtures ? new RecordingTransport(base) : base;
  const db = writeDb ? getDb() : undefined;
  const cache: CacheStore = !db ? new InMemoryCacheStore() : recordFixtures ? new WriteThroughCache(new PostgresCacheStore(db)) : new PostgresCacheStore(db);
  const today = new Date().toISOString().slice(0, 10);
  const updated = [...rooms];
  let totalLive = 0;

  for (const [i, room] of rooms.entries()) {
    const client = createQlooClient({
      transport,
      cache,
      onEvent,
      ...(writeDb ? { ttlSeconds: { search: PINNED_TTL_SECONDS, compare: PINNED_TTL_SECONDS, heatmap: PINNED_TTL_SECONDS, recommend: PINNED_TTL_SECONDS } } : {}),
    });
    const t0 = Date.now();
    const { slate } = await buildSampleSlate(room, client, "live", () => new Date());
    const calls = client.stats().liveCalls;
    totalLive += calls;
    console.log(`${describe(room)}: ${slate.results.length} acts scored in ${Date.now() - t0} ms, ${calls} live calls`);
    if (db) {
      await putPinnedSlate(db, sampleId(room.slug), slate, new Date());
      console.log(`pinned ${sampleId(room.slug)}`);
    }
    updated[i] = { ...room, recordedOn: today };
  }

  if (transport instanceof RecordingTransport) console.log(`recorded ${transport.recorded.length} new fixtures: ${transport.recorded.join(", ")}`);
  if (recordFixtures || writeDb) writeFileSync(ROOMS_FILE, formatRooms(updated));
  console.log(`live calls: ${totalLive}; events ${JSON.stringify(events)}`);
  await closeDb();
}

async function main(): Promise<void> {
  const rooms = loadSampleRooms();
  if (dryRun) return dry(rooms);
  if (!recordFixtures && !writeDb) throw new Error("choose --dry-run, --record-fixtures and/or --write-db");
  return live(rooms);
}

main().catch((e: unknown) => {
  // Only the error class and a fixed-text message: never the request, URL or any header.
  console.error(`prewarm failed: ${e instanceof Error ? `${e.name}: ${e.message.slice(0, 200)}` : "unknown error"}`);
  process.exit(1);
});
