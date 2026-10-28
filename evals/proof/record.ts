// Live recording for the proof (`npm run proof -- --live`). A transport wrapper writes every 200 response
// the adapter receives to fixtures/qloo/proof/ in the M0-02 fixture format and keeps the call log. The key is
// read from the environment by liveTransportFromEnv; no header or key is ever written.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createQlooClient,
  InMemoryCacheStore,
  liveTransportFromEnv,
  type QlooClient,
  type QlooEvent,
  type QlooTransport,
  type TransportRequest,
  type TransportResponse,
} from "../../packages/qloo/src/index";
import { ADAPTER_VERSION, FIXTURE_DIR, RUN_LOG_PATH, type EndpointStats, type RunLog } from "./common";

const MAX_CONCURRENT = 3;

const byName = ([a]: [string, string], [b]: [string, string]): number => (a < b ? -1 : a > b ? 1 : 0);

function keyOf(endpoint: string, params: URLSearchParams): string {
  return `${endpoint}?${new URLSearchParams([...params.entries()].sort(byName)).toString()}`;
}

class RecordingTransport implements QlooTransport {
  readonly index: Record<string, string> = {};
  constructor(private readonly inner: QlooTransport) {
    const p = join(FIXTURE_DIR, "index.json");
    if (existsSync(p)) Object.assign(this.index, JSON.parse(readFileSync(p, "utf8")) as Record<string, string>);
  }

  async get(req: TransportRequest): Promise<TransportResponse> {
    const t0 = Date.now();
    const res = await this.inner.get(req);
    if (res.status === 200) {
      const key = keyOf(req.endpoint, req.params);
      const kind =
        req.endpoint === "/search"
          ? "search"
          : req.endpoint.endsWith("/compare")
            ? "compare"
            : req.params.get("filter.type") === "urn:heatmap"
              ? "heatmap"
              : "insights";
      const file = `${kind}--${createHash("sha1").update(key).digest("hex").slice(0, 10)}.json`;
      const sorted = [...req.params.entries()].sort(byName);
      writeFileSync(
        join(FIXTURE_DIR, file),
        JSON.stringify(
          { endpoint: req.endpoint, params: Object.fromEntries(sorted), status: res.status, recordedAt: new Date().toISOString(), latencyMs: Date.now() - t0, body: res.body },
          null,
          2,
        ) + "\n",
      );
      this.index[key] = file;
    }
    return res;
  }

  writeIndex(): void {
    const ordered = Object.fromEntries(Object.entries(this.index).sort(byName));
    writeFileSync(join(FIXTURE_DIR, "index.json"), JSON.stringify(ordered, null, 2) + "\n");
  }
}

const pct = (sorted: readonly number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] ?? 0;

export interface Recorder {
  readonly client: QlooClient;
  finish(): RunLog;
}

/** A live adapter client over a recording transport. Call finish() once, after the run, to write index and log. */
export function createRecorder(logPath: string = RUN_LOG_PATH): Recorder {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const transport = new RecordingTransport(liveTransportFromEnv());
  const calls: { endpoint: string; status: number; ms: number }[] = [];
  let retries = 0;
  const started = Date.now();
  const client = createQlooClient({
    transport,
    cache: new InMemoryCacheStore(),
    maxConcurrent: MAX_CONCURRENT,
    onEvent: (e: QlooEvent) => {
      if (e.type === "live_call") calls.push({ endpoint: e.endpoint, status: e.status, ms: e.ms });
      if (e.type === "retry") retries += 1;
    },
  });
  return {
    client,
    finish(): RunLog {
      transport.writeIndex();
      const statusCounts: Record<string, number> = {};
      for (const c of calls) statusCounts[String(c.status)] = (statusCounts[String(c.status)] ?? 0) + 1;
      const byEndpoint: EndpointStats[] = [...new Set(calls.map((c) => c.endpoint))].sort().map((endpoint) => {
        const ms = calls.filter((c) => c.endpoint === endpoint).map((c) => c.ms).sort((a, b) => a - b);
        return { endpoint, calls: ms.length, medianMs: pct(ms, 0.5), p95Ms: pct(ms, 0.95), maxMs: ms[ms.length - 1] ?? 0 };
      });
      const log: RunLog = {
        recordedAt: new Date().toISOString(),
        adapterVersion: ADAPTER_VERSION,
        maxConcurrent: MAX_CONCURRENT,
        liveCalls: calls.length,
        retries,
        statusCounts,
        rateLimited429: statusCounts["429"] ?? 0,
        wallSeconds: Math.round((Date.now() - started) / 1000),
        byEndpoint,
      };
      writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");
      return log;
    },
  };
}
