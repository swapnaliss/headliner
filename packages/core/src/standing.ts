import { isUnitInterval, roundTo, unavailable, type Unavailable } from "./num";

/** The label users see next to the standing number. It is a popularity rank, not a draw claim. */
export const STANDING_CAPTION = "Qloo popularity rank";
/** Within this many percentile points of the crowd median the label is "similar" (ADR 0013). */
export const STANDING_SIMILAR_BAND_POINTS = 5;

export type StandingLabel = "above" | "similar" | "below";

export interface StandingOk {
  readonly status: "ok";
  readonly caption: typeof STANDING_CAPTION;
  /** Search `popularity` x 100, one decimal. */
  readonly candidatePercentile: number;
  readonly crowdMedianPercentile: number;
  /** Crowd acts with a usable popularity. */
  readonly crowdSample: number;
  /** Candidate minus crowd median, in percentile points, one decimal. */
  readonly deltaPoints: number;
  readonly label: StandingLabel;
}

export type StandingResult = StandingOk | Unavailable;

function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] as number;
  return sorted.length % 2 === 1 ? hi : ((sorted[mid - 1] as number) + hi) / 2;
}

/** Candidate's Qloo popularity against the median popularity of the crowd acts. */
export function computeStanding(
  candidate: number | null | undefined,
  crowd: readonly (number | null | undefined)[],
): StandingResult {
  if (!isUnitInterval(candidate)) return unavailable("candidate-popularity-missing");
  const usable = crowd.filter(isUnitInterval).sort((a, b) => a - b);
  if (usable.length === 0) return unavailable("crowd-popularity-missing");
  const candidatePercentile = roundTo(candidate * 100, 1);
  const crowdMedianPercentile = roundTo(median(usable) * 100, 1);
  const deltaPoints = roundTo(candidatePercentile - crowdMedianPercentile, 1);
  const label: StandingLabel =
    deltaPoints > STANDING_SIMILAR_BAND_POINTS
      ? "above"
      : deltaPoints < -STANDING_SIMILAR_BAND_POINTS
        ? "below"
        : "similar";
  return {
    status: "ok",
    caption: STANDING_CAPTION,
    candidatePercentile,
    crowdMedianPercentile,
    crowdSample: usable.length,
    deltaPoints,
    label,
  };
}
