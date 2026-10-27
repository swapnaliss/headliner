import type { Db } from "@headliner/slates";
import { charge, type ChargeResult } from "./charge";
import type { BudgetConfig } from "./config";
import { clientIp, ipHash, secondsToUtcMidnight, utcDay } from "./ip";

/** What a request intends to spend. Cache hits and stored-slate reads spend 0 and never reach the store. */
export interface Cost {
  /** Names the route in the deny log line. Never a path with ids, never user text. */
  readonly route: string;
  /** The most live Qloo calls the request may make (an upper bound; `settle` gives back the unused part). */
  readonly qlooCalls?: number;
  /** The most LLM tokens the request may use. */
  readonly llmTokens?: number;
}

export type DenyReason = "ip_limit" | "store_unavailable";

export interface Actual {
  readonly qlooCalls?: number;
  readonly llmTokens?: number;
}

export type GuardDecision =
  | {
      readonly kind: "allow";
      /** `cache_only`: the global Qloo ceiling is reached; serve from cache and recorded data, make no live call. */
      readonly qloo: "live" | "cache_only";
      /** `deterministic_only`: an LLM ceiling is reached; the agent layer degrades to templates, never errors. */
      readonly llm: "on" | "deterministic_only";
      /** Replace the reservation with what was really spent. Idempotent and never throws. */
      readonly settle: (actual: Actual) => Promise<void>;
    }
  | {
      readonly kind: "deny";
      readonly reason: DenyReason;
      /** Seconds to the next UTC midnight, for `Retry-After`. */
      readonly retryAfterSeconds: number;
    };

export interface GuardOptions {
  /** Lazy so that a missing or broken database is a fail-closed denial, not a crash at import. */
  readonly db: () => Db;
  readonly config: BudgetConfig;
  readonly now?: () => Date;
  /** Upper bound on one budget-store round trip. */
  readonly timeoutMs?: number;
  /** Deny/degrade events for observability (M3-05). Carries a route and a reason, never an address. */
  readonly onEvent?: (event: GuardEvent) => void;
}

export interface GuardEvent {
  readonly event: "budget_deny" | "budget_global_qloo" | "budget_llm_degraded" | "budget_store_error";
  readonly route: string;
  readonly reason?: string;
}

export type Guard = (request: Request | Headers, cost: Cost) => Promise<GuardDecision>;

const DEFAULT_TIMEOUT_MS = 4_000;

function defaultSink(event: GuardEvent): void {
  console.warn(JSON.stringify({ level: "warn", ...event }));
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("budget store timeout")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The per-request budget check (ADR 0008).
 *
 * - Reserves the planned cost atomically (`charge`), then decides on the returned totals, so
 *   concurrent requests cannot overshoot a limit.
 * - Per-IP Qloo limit exceeded: `deny{ip_limit}` and the reservation is given back.
 * - Global Qloo ceiling exceeded: allowed as `cache_only` (no live call; cached data and recorded
 *   samples only), reservation given back.
 * - Per-IP or global LLM ceiling exceeded: allowed as `deterministic_only`, reservation given back.
 * - Budget store unreachable (or no `BUDGET_SALT`): `deny{store_unavailable}`. Metered work stops;
 *   reads of stored slates and sample rooms never call the guard, so they still load.
 * - A request that costs 0 is allowed without touching the store.
 */
export function createGuard(options: GuardOptions): Guard {
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const emit = options.onEvent ?? defaultSink;

  const safeEmit = (event: GuardEvent): void => {
    try {
      emit(event);
    } catch {
      // an observer must never break a request
    }
  };

  return async (request, cost) => {
    const config = options.config;
    const wantQloo = Math.max(0, Math.floor(cost.qlooCalls ?? 0));
    const wantLlm = Math.max(0, Math.floor(cost.llmTokens ?? 0));
    const free = (): GuardDecision => ({ kind: "allow", qloo: "live", llm: "on", settle: async () => undefined });
    if (wantQloo === 0 && wantLlm === 0) return free();

    const at = now();
    const retryAfterSeconds = secondsToUtcMidnight(at);
    const failClosed = (): GuardDecision => {
      safeEmit({ event: "budget_store_error", route: cost.route });
      return { kind: "deny", reason: "store_unavailable", retryAfterSeconds };
    };
    if (!config.salt) return failClosed();

    const day = utcDay(at);
    const headers = request instanceof Request ? request.headers : request;
    const key = ipHash(clientIp(headers), day, config.salt);

    const apply = async (qlooCalls: number, llmTokens: number): Promise<ChargeResult> =>
      withTimeout(charge(options.db(), { ipHash: key, day, qlooCalls, llmTokens }), timeoutMs);
    const giveBack = async (qlooCalls: number, llmTokens: number): Promise<void> => {
      if (qlooCalls === 0 && llmTokens === 0) return;
      try {
        await apply(-qlooCalls, -llmTokens);
      } catch {
        // best effort: the worst case is a visitor losing a little of today's allowance
      }
    };

    let totals: ChargeResult;
    try {
      totals = await apply(wantQloo, wantLlm);
    } catch {
      return failClosed();
    }

    if (wantQloo > 0 && totals.ip.qlooCalls > config.ipQlooCalls) {
      await giveBack(wantQloo, wantLlm);
      safeEmit({ event: "budget_deny", route: cost.route, reason: "ip_limit" });
      return { kind: "deny", reason: "ip_limit", retryAfterSeconds };
    }

    let qloo: "live" | "cache_only" = "live";
    let llm: "on" | "deterministic_only" = "on";
    let reservedQloo = wantQloo;
    let reservedLlm = wantLlm;
    if (wantQloo > 0 && totals.global.qlooCalls > config.globalQlooCalls) {
      qloo = "cache_only";
      reservedQloo = 0;
      safeEmit({ event: "budget_global_qloo", route: cost.route });
    }
    if (wantLlm > 0 && (totals.ip.llmTokens > config.ipLlmTokens || totals.global.llmTokens > config.globalLlmTokens)) {
      llm = "deterministic_only";
      reservedLlm = 0;
      safeEmit({ event: "budget_llm_degraded", route: cost.route });
    }
    await giveBack(wantQloo - reservedQloo, wantLlm - reservedLlm);

    let settled = false;
    return {
      kind: "allow",
      qloo,
      llm,
      settle: async (actual) => {
        if (settled) return;
        settled = true;
        const qlooDelta = reservedQloo === 0 ? 0 : Math.max(0, Math.floor(actual.qlooCalls ?? reservedQloo)) - reservedQloo;
        const llmDelta = reservedLlm === 0 ? 0 : Math.max(0, Math.floor(actual.llmTokens ?? reservedLlm)) - reservedLlm;
        if (qlooDelta === 0 && llmDelta === 0) return;
        try {
          await apply(qlooDelta, llmDelta);
        } catch {
          // the reservation stands; over-counting is the safe direction
        }
      },
    };
  };
}
