import { existsSync } from "node:fs";
import {
  createIntakeReplay,
  createOpenAiProvider,
  DEFAULT_LLM_MODEL,
  loadIntakeTraces,
  type ExplainBudget,
  type ExplainModel,
  type LlmBudget,
  type LlmProvider,
} from "@headliner/agent";
import { dirname, join, resolve } from "node:path";
import {
  createQlooClient,
  FixtureTransport,
  InMemoryCacheStore,
  liveTransportFromEnv,
  PostgresCacheStore,
  type QlooClient,
  type QlooTransport,
} from "@headliner/qloo";
import { getDb } from "@headliner/slates";
import { liveBudgetHook, liveExplainBudget, liveLlmBudget } from "./budget";
import { explainModelFrom } from "./explainModel";
import { loadEnv } from "./env";
import { logQlooEvent } from "./log";
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
  /** Qloo client that cannot make a live call (cache only). Used when the global Qloo ceiling is reached (M2-05). */
  readonly cacheOnlyClient?: QlooClient;
  /** Budget check (M2-05, live mode only). Absent means no check. It throws an `ApiError` to refuse. */
  readonly budget?: BudgetHook;
  /**
   * The model behind the explanation (M3-02): live mode with an OpenAI key only. Absent (fixtures mode, no key):
   * the explanation is the deterministic template and no model call is made.
   */
  readonly explainModel?: ExplainModel;
  /** LLM budget for the explanation, asked before each model turn (M2-05 guard). Absent: no check. */
  readonly explainBudget?: (headers: Headers) => ExplainBudget;
  /** Intake model wiring (M3-01). Absent means no model: the intake route answers `deterministic`. */
  readonly intake?: IntakeEnv;
}

/** What the intake route needs: a provider per sentence, and (live mode) the per-turn LLM budget. */
export interface IntakeEnv {
  /** `recorded` replays `fixtures/agent/intake` (DEMO_MODE=fixtures, no key); `model` calls OpenAI. */
  readonly source: "model" | "recorded";
  /** Undefined means no model is configured (for example no OPENAI_API_KEY). */
  providerFor(text: string, clarified: boolean): LlmProvider | undefined;
  /** App-side LLM budget for this request (live mode only). */
  budgetFor?(request: Request): LlmBudget;
}

/** What a granted budget check returns. */
export interface BudgetGrant {
  /** True when the global Qloo ceiling is reached: run on `Runtime.cacheOnlyClient`. */
  readonly cacheOnly: boolean;
  readonly retryAfterSeconds: number;
  /** Replaces the reservation with the live calls really made. Never throws. */
  readonly settle: (liveCalls: number) => Promise<void>;
}

/** Called before a route spends Qloo calls: `plannedCalls` is the most live calls the request may make. */
export type BudgetHook = (spend: {
  readonly route: "create" | "confirm" | "cities" | "intake";
  readonly plannedCalls: number;
  readonly request: Request;
}) => void | BudgetGrant | Promise<void | BudgetGrant>;

/** A transport that refuses every call, so a client built on it can only answer from the cache. */
class CacheOnlyTransport implements QlooTransport {
  get(): Promise<never> {
    return Promise.reject(new Error("cache only"));
  }
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
    const fixtureDir = findFixtureDir(source);
    return {
      mode: "fixtures",
      client: createQlooClient({ transport: new FixtureTransport(fixtureDir), cache: new InMemoryCacheStore(), onEvent: logQlooEvent }),
      // Sample rooms (M2-06) are rebuilt from the same recordings on first open.
      store: new FixtureSampleStore(new MemorySlateStore(), fixtureDir),
      runs: new MemoryRunStore(),
      now: () => new Date(),
      intake: fixtureIntake(fixtureDir),
    };
  }
  const db = getDb(source);
  const cache = new PostgresCacheStore(db);
  return {
    mode: "live",
    client: createQlooClient({ transport: liveTransportFromEnv(source), cache, onEvent: logQlooEvent }),
    cacheOnlyClient: createQlooClient({ transport: new CacheOnlyTransport(), cache, onEvent: logQlooEvent }),
    budget: liveBudgetHook(db, source),
    // Explanation model (M3-02): only with an OpenAI key; the same provider settings as intake. No second client.
    ...(env.openaiApiKey ? { explainModel: explainModelFrom(createOpenAiProvider({ apiKey: env.openaiApiKey, model: llmModel(source) })) } : {}),
    explainBudget: liveExplainBudget(db, source),
    store: new PostgresSlateStore(db),
    runs: new PostgresRunStore(db),
    now: () => new Date(),
    intake: liveIntake(env.openaiApiKey, source, liveLlmBudget(db, source)),
  };
}

/** Recorded traces next to the Qloo recordings: `fixtures/agent/intake`. A missing directory means no traces. */
function fixtureIntake(qlooFixtureDir: string): IntakeEnv {
  const dir = join(qlooFixtureDir, "..", "agent", "intake");
  const replay = createIntakeReplay(existsSync(dir) ? loadIntakeTraces(dir) : []);
  return { source: "recorded", providerFor: (text, clarified) => replay.providerFor(text, clarified) };
}

/** `LLM_MODEL` overrides the default model; anything that is not a plain model id is ignored. */
export function llmModel(source: Record<string, string | undefined>): string {
  const v = source["LLM_MODEL"]?.trim();
  return v && /^[A-Za-z0-9._-]{1,64}$/.test(v) ? v : DEFAULT_LLM_MODEL;
}

function liveIntake(apiKey: string | undefined, source: Record<string, string | undefined>, budgetFor: (request: Request) => LlmBudget): IntakeEnv {
  const provider = apiKey ? createOpenAiProvider({ apiKey, model: llmModel(source) }) : undefined;
  return { source: "model", providerFor: () => provider, budgetFor };
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
