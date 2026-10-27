import type { BudgetLease, ExplainBudget } from "@headliner/agent";
import { createGuard, DEFAULT_LIMITS, loadBudgetConfig, secondsToUtcMidnight, type BudgetConfig, type Guard } from "@headliner/budgets";
import type { Db } from "@headliner/slates";
import type { BudgetGrant, BudgetHook, Runtime } from "./config";
import { ApiError } from "./errors";

/** The routes that spend live Qloo calls and so ask the budget first. */
export type MeteredRoute = "create" | "confirm" | "cities";

/**
 * The live-mode budget hook (M2-05, ADR 0008): the guard from `@headliner/budgets` over the Postgres
 * `budgets` table. A denial is an `ApiError("demo_limit_reached")` with the seconds to the next UTC
 * midnight; a malformed limit variable fails closed the same way (no metered work without a valid budget).
 */
export function liveGuard(db: Db, source: Record<string, string | undefined> = process.env, now: () => Date = () => new Date()): Guard {
  let config: BudgetConfig | undefined;
  let configFailed = false;
  return createGuard({
    db: () => db,
    get config() {
      if (!config && !configFailed) {
        try {
          config = loadBudgetConfig(source);
        } catch {
          configFailed = true;
        }
      }
      // A failed config has no salt, so the guard fails closed (deny store_unavailable).
      return config ?? { ipQlooCalls: 0, ipLlmTokens: 0, globalQlooCalls: 0, globalLlmTokens: 0, salt: undefined };
    },
    now,
  });
}

/** The explanation's LLM budget (M3-02) over the same guard: asked before each model turn with the tokens it may use. A denial, or a reached LLM ceiling (`deterministic_only`), is `null` and the explanation uses its template. */
export function llmBudgetFrom(guard: Guard, headers: Headers): ExplainBudget {
  return async (estimatedTokens): Promise<BudgetLease | null> => {
    const decision = await guard(headers, { route: "explain", llmTokens: estimatedTokens });
    if (decision.kind === "deny") return null;
    if (decision.llm === "deterministic_only") {
      await decision.settle({ llmTokens: 0 });
      return null;
    }
    return { settle: (actualTokens) => decision.settle({ llmTokens: actualTokens }) };
  };
}

export function liveBudgetHook(db: Db, source: Record<string, string | undefined> = process.env, now: () => Date = () => new Date()): BudgetHook {
  const guard = liveGuard(db, source, now);
  return async ({ route, plannedCalls, request }): Promise<BudgetGrant> => {
    const decision = await guard(request, { route, qlooCalls: plannedCalls });
    if (decision.kind === "deny") throw new ApiError("demo_limit_reached", undefined, decision.retryAfterSeconds);
    return {
      cacheOnly: decision.qloo === "cache_only",
      retryAfterSeconds: secondsToUtcMidnight(now()),
      settle: (liveCalls) => decision.settle({ qlooCalls: liveCalls }),
    };
  };
}

export interface Spend {
  readonly route: MeteredRoute;
  /** The most live Qloo calls the work may make. */
  readonly plannedCalls: number;
  readonly request: Request;
}

/**
 * Runs `work` under the budget. No hook (fixtures mode, tests) runs it as is. Otherwise the hook is
 * asked BEFORE any Qloo call and may refuse by throwing. A global-ceiling grant runs the work on the
 * cache-only client (no live call can happen, so cached data is all it can use); if that leaves
 * nothing to show, the caller gets the daily-limit error, not a misleading "provider unavailable".
 * Afterwards the reservation is replaced with the live calls actually made (cache hits cost 0).
 */
export async function metered<T>(rt: Runtime, spend: Spend, work: (rt: Runtime) => Promise<T>): Promise<T> {
  const grant = await rt.budget?.(spend);
  if (!grant) return work(rt);

  if (grant.cacheOnly) {
    if (!rt.cacheOnlyClient) throw new ApiError("demo_limit_reached", undefined, grant.retryAfterSeconds);
    try {
      return await work({ ...rt, client: rt.cacheOnlyClient });
    } catch (e) {
      if (e instanceof ApiError && (e.code === "upstream_unavailable" || e.code === "rate_limited")) {
        throw new ApiError("demo_limit_reached", undefined, grant.retryAfterSeconds);
      }
      throw e;
    } finally {
      await grant.settle(0);
    }
  }

  const before = rt.client.stats().liveCalls;
  try {
    return await work(rt);
  } finally {
    await grant.settle(Math.max(0, rt.client.stats().liveCalls - before));
  }
}

/** The per-visitor daily Qloo-call limit shown on the intake screen: the configured value, else the default. */
export function displayedDailyQlooCalls(source: Record<string, string | undefined> = process.env): number {
  try {
    return loadBudgetConfig(source).ipQlooCalls;
  } catch {
    return DEFAULT_LIMITS.ipQlooCalls;
  }
}
