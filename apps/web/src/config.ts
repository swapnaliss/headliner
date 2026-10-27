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
import { MemoryRunStore, PostgresRunStore, type RunStore } from "./runStore";
import { FixtureSampleStore } from "./samples";
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
  /** Runs awaiting match confirmation (M2-01). */
  readonly runs: RunStore;
  readonly now: () => Date;
  /** Per-IP budget check (M2-05 supplies it). Absent means no check. It throws an `ApiError` to refuse. */
  readonly budget?: BudgetHook;
}

/** Called before a route spends Qloo calls: `plannedCalls` is the most live calls the request may make. */
export type BudgetHook = (spend: { readonly route: "cities"; readonly plannedCalls: number; readonly request: Request }) => void | Promise<void>;

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
    const fixtureDir = findFixtureDir(source);
    return {
      mode: "fixtures",
      client: createQlooClient({ transport: new FixtureTransport(fixtureDir), cache: new InMemoryCacheStore() }),
      // Sample rooms (M2-06) are rebuilt from the same recordings on first open.
      store: new FixtureSampleStore(new MemorySlateStore(), fixtureDir),
      runs: new MemoryRunStore(),
      now: () => new Date(),
    };
  }
  const db = getDb(source);
  return {
    mode: "live",
    client: createQlooClient({ transport: liveTransportFromEnv(source), cache: new PostgresCacheStore(db) }),
    store: new PostgresSlateStore(db),
    runs: new PostgresRunStore(db),
    now: () => new Date(),
  };
}

/**
 * Per-process singleton, so the in-memory cache and store persist across requests. Held on
 * `globalThis` because Next bundles route handlers and pages separately: a module-level variable
 * would give the slate page a different (empty) store from the one the API route saved into.
 */
const RUNTIME_KEY = Symbol.for("headliner.runtime");
type RuntimeHolder = { [RUNTIME_KEY]?: Runtime | undefined };

export function getRuntime(): Runtime {
  const holder = globalThis as RuntimeHolder;
  holder[RUNTIME_KEY] ??= buildRuntime();
  return holder[RUNTIME_KEY];
}

/** Test seam: install a runtime (or clear it with undefined). */
export function setRuntimeForTests(runtime: Runtime | undefined): void {
  (globalThis as RuntimeHolder)[RUNTIME_KEY] = runtime;
}
