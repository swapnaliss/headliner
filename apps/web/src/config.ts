import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  createQlooClient,
  FixtureTransport,
  InMemoryCacheStore,
  liveTransportFromEnv,
  PostgresCacheStore,
  type QlooClient,
} from "@headliner/qloo";
import { getDb } from "@headliner/slates";
import { loadEnv } from "./env";
import { MemorySlateStore, PostgresSlateStore, type SlateStore } from "./slateStore";

/**
 * The one server-side config module (ADR 0011). `DEMO_MODE=fixtures` (the default) wires the
 * recorded fixtures and in-memory stores: no key, no database, no LLM and no outbound network.
 * `DEMO_MODE=live` wires the hackathon Qloo host, the Postgres cache and the `slates` table.
 */
export interface Runtime {
  readonly mode: "fixtures" | "live";
  readonly client: QlooClient;
  readonly store: SlateStore;
  readonly now: () => Date;
}

/** Walks up from the working directory to the repository's `fixtures/qloo` (or FIXTURES_DIR). */
export function findFixtureDir(source: Record<string, string | undefined> = process.env, start: string = process.cwd()): string {
  const override = source["FIXTURES_DIR"];
  if (override) return resolve(/*turbopackIgnore: true*/ override);
  let dir = resolve(/*turbopackIgnore: true*/ start);
  for (;;) {
    const candidate = join(dir, "fixtures", "qloo");
    if (existsSync(join(candidate, "index.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error("fixtures/qloo not found");
    dir = parent;
  }
}

export function buildRuntime(source: Record<string, string | undefined> = process.env): Runtime {
  const env = loadEnv(source);
  if (env.mode === "fixtures") {
    return {
      mode: "fixtures",
      client: createQlooClient({ transport: new FixtureTransport(findFixtureDir(source)), cache: new InMemoryCacheStore() }),
      store: new MemorySlateStore(),
      now: () => new Date(),
    };
  }
  const db = getDb(source);
  return {
    mode: "live",
    client: createQlooClient({ transport: liveTransportFromEnv(source), cache: new PostgresCacheStore(db) }),
    store: new PostgresSlateStore(db),
    now: () => new Date(),
  };
}

let current: Runtime | undefined;

/** Per-process singleton, so the in-memory cache and store persist across requests. */
export function getRuntime(): Runtime {
  current ??= buildRuntime();
  return current;
}

/** Test seam: install a runtime (or clear it with undefined). */
export function setRuntimeForTests(runtime: Runtime | undefined): void {
  current = runtime;
}
