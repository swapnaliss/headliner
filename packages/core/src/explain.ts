import type { ActResult, StandingExplanation } from "./types";

/**
 * The structured standing explanation for an act: the stored one when present, otherwise derived
 * from `standing` (its evidence refs are the candidate's search first, then the crowd searches).
 * Returns null when no standing is shown. Pure: nothing is computed that is not already stored.
 */
export function standingExplanationOf(result: Pick<ActResult, "standing" | "standingExplanation">): StandingExplanation | null {
  if (result.standingExplanation) return result.standingExplanation;
  const standing = result.standing;
  if (!standing) return null;
  const [candidate, ...crowd] = standing.evidenceRefs;
  if (candidate === undefined || crowd.length === 0) return null;
  return {
    candidatePercentile: standing.candidatePercentile,
    crowdMedianPercentile: standing.crowdMedianPercentile,
    crowdSample: standing.crowdSample,
    candidateEvidenceRef: candidate,
    crowdEvidenceRefs: crowd,
  };
}
