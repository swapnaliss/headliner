import type { ActResult } from "./types";

export class EvidenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceInvariantError";
  }
}

/**
 * Domain invariant: every number shown for an act has at least one Evidence entry (ADR 0001).
 * Throws EvidenceInvariantError when the fit, the standing, any city strength or the overlap
 * tags lack a reference, or a reference does not match an entry in `actResult.evidence`.
 */
export function assertEveryNumberHasEvidence(actResult: ActResult): void {
  const known = new Set(actResult.evidence.map((e) => e.id));
  const name = actResult.act.name;
  const check = (label: string, refs: readonly string[]): void => {
    if (refs.length === 0) throw new EvidenceInvariantError(`${label} for "${name}" has no evidence reference`);
    for (const ref of refs) {
      if (!known.has(ref)) throw new EvidenceInvariantError(`${label} for "${name}" cites unknown evidence "${ref}"`);
    }
  };
  if (actResult.fit) check("fit", actResult.fit.evidenceRefs);
  else if (actResult.overlapTags.length > 0) {
    throw new EvidenceInvariantError(`overlap tags for "${name}" have no fit and therefore no evidence reference`);
  }
  if (actResult.standing) check("standing", actResult.standing.evidenceRefs);
  const explanation = actResult.standingExplanation;
  if (explanation) check("standing explanation", [explanation.candidateEvidenceRef, ...explanation.crowdEvidenceRefs]);
  for (const strength of actResult.cityStrengths) check(`city strength (${strength.city})`, strength.evidenceRefs);
}
