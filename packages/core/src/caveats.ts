import type { CityStrengthResult } from "./city";
import { THIN_DATA_CELLS } from "./city";
import type { FitResult, FitUnavailableReason } from "./fit";
import { FIT_MIN_SHARED_TAGS } from "./fit";
import { compareStrings } from "./num";
import type { StandingResult } from "./standing";
import type { Caveat } from "./types";

/**
 * Match confidence below this raises `low-match-confidence`. Provisional: M2-01 owns how
 * confidence is derived and may revise the value (ADR 0013 does not define it).
 */
export const LOW_MATCH_CONFIDENCE = 0.5;

const NO_DATA_WORDING: Readonly<Record<FitUnavailableReason, string>> = {
  "no-shared-tags": "Qloo returned no shared audience tags for this act, so no audience-taste fit is shown.",
  "too-few-shared-tags": `Qloo found fewer than ${FIT_MIN_SHARED_TAGS} shared audience tags for this act, so no audience-taste fit is shown.`,
  "unresolved-entity": "This act was not matched to a Qloo entity, so no audience-taste fit is shown.",
  "candidate-in-crowd": "This act is already one of the regular-crowd acts, so no audience-taste fit is shown.",
};

export const CAVEAT_WORDING = {
  "single-tag-overlap": "Only one shared audience tag was found, so the overlap with the regular crowd is very thin.",
  "standing-unavailable": "Qloo popularity rank is unavailable for this act or the crowd, so no standing comparison is shown.",
  "low-match-confidence": "The match to a Qloo entity has low confidence. Check the matched name before relying on this result.",
  "thin-data": `Fewer than ${THIN_DATA_CELLS} Qloo heatmap cells back this city, so its strength is thin data.`,
  "city-no-data": "Qloo returned no usable heatmap cells for this city, so no city strength is shown.",
} as const;

export interface CaveatInput {
  readonly fit: FitResult;
  readonly standing: StandingResult;
  /** 0..1 name-to-entity match confidence; null or undefined when not known (no caveat is guessed). */
  readonly matchConfidence?: number | null | undefined;
  /** City strengths computed for this act, one entry per city looked up. */
  readonly cities?: readonly { readonly city: string; readonly strength: CityStrengthResult }[];
}

/**
 * Typed caveats for one act, in a fixed order: no-data, single-tag-overlap, standing-unavailable,
 * low-match-confidence, then per-city thin-data / no-data sorted by city. Wording is fixed here;
 * the only free text is `subject` (a city string), which callers render as plain text.
 */
export function buildCaveats(input: CaveatInput): Caveat[] {
  const caveats: Caveat[] = [];
  if (input.fit.status === "unavailable") {
    caveats.push({ type: "no-data", message: NO_DATA_WORDING[input.fit.reason] });
    if (input.fit.reason === "too-few-shared-tags" && input.fit.sharedTags === 1) {
      caveats.push({ type: "single-tag-overlap", message: CAVEAT_WORDING["single-tag-overlap"] });
    }
  }
  if (input.standing.status === "unavailable") {
    caveats.push({ type: "standing-unavailable", message: CAVEAT_WORDING["standing-unavailable"] });
  }
  const confidence = input.matchConfidence;
  if (typeof confidence === "number" && Number.isFinite(confidence) && confidence < LOW_MATCH_CONFIDENCE) {
    caveats.push({ type: "low-match-confidence", message: CAVEAT_WORDING["low-match-confidence"] });
  }
  const cities = [...(input.cities ?? [])].sort((a, b) => compareStrings(a.city, b.city));
  for (const { city, strength } of cities) {
    if (strength.status === "unavailable") {
      caveats.push({ type: "no-data", message: CAVEAT_WORDING["city-no-data"], subject: city });
    } else if (strength.thinData) {
      caveats.push({ type: "thin-data", message: CAVEAT_WORDING["thin-data"], subject: city });
    }
  }
  return caveats;
}
