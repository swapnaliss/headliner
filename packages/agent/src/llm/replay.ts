import { LlmError, type LlmProvider, type LlmTurn } from "./types";

/**
 * Replays recorded model turns in order (DEMO_MODE=fixtures and tests). Needs no key and no network.
 * Running past the recording is a `no_recording` error, never an invented answer.
 */
export function createReplayProvider(turns: readonly LlmTurn[], model = "recorded"): LlmProvider {
  let next = 0;
  return {
    model,
    async complete(): Promise<LlmTurn> {
      const turn = turns[next];
      if (!turn) throw new LlmError("no_recording");
      next += 1;
      return turn;
    },
  };
}
