import type { LlmTurn } from "./types";

/**
 * Hook into the app-side budget (M2-05 `createGuard`, `llmTokens`). The agent package does not import
 * `@headliner/budgets`; the web layer adapts the guard to this shape.
 *
 * Call `reserve(maxTokens)` BEFORE every model turn. `null` means a ceiling is reached (per-IP or global,
 * or the budget store is unreachable: fail closed): make no model call and use the deterministic path.
 * After the turn, `settle(actualTokens)` replaces the reservation with the tokens really used.
 */
export interface LlmBudget {
  reserve(maxTokens: number): Promise<LlmTurnGrant | null>;
}

export interface LlmTurnGrant {
  /** Idempotent, never throws. */
  settle(actualTokens: number): Promise<void>;
}

/** Rough upper estimate of prompt tokens (about 3 characters per token for mixed text), used only for reservations. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/** Per-run ceilings: tokens and spend. A run that would pass either stops and falls back to the deterministic path. */
export class RunMeter {
  private tokens = 0;
  private cost = 0;
  private turns = 0;

  constructor(
    readonly maxTokens: number,
    readonly maxCostUsd: number,
  ) {}

  /** True when a turn that may use `reserveTokens` still fits under both ceilings. */
  canAfford(reserveTokens: number): boolean {
    return this.tokens + reserveTokens <= this.maxTokens && this.cost < this.maxCostUsd;
  }

  record(turn: LlmTurn): void {
    this.turns += 1;
    this.tokens += turn.usage.totalTokens;
    this.cost += turn.costUsd;
  }

  get totals(): { readonly turns: number; readonly tokens: number; readonly costUsd: number } {
    return { turns: this.turns, tokens: this.tokens, costUsd: this.cost };
  }
}
