import type { CityStrengthResult } from "./city";
import { THIN_DATA_CELLS } from "./city";
import type { FitResult, FitUnavailableReason } from "./fit";
import { FIT_MIN_SHARED_TAGS } from "./fit";
import { compareStrings } from "./num";
import type { StandingResult } from "./standing";
import type { Caveat } from "./types";

/**
 * Match confidence below this raises `low-match-confidence`: 1 = one exact top hit, 0.5 = the user chose among several (MATCH_CONFIDENCE in matching.ts). M2-01 owns how
 * confidence is derived and may revise the value (ADR 0013 does not define it).
 */
export const LOW_MATCH_CONFIDENCE = 0.75;

const NO_DATA_WORDING: Readonly<Record<FitUnavailableReason, string>> = {
  "no-shared-tags": "Qloo returned no shared audience tags for this act, so no audience-taste fit is shown.",
  "too-few-shared-tags": `Qloo found fewer than ${FIT_MIN_SHARED_TAGS} shared audience tags for this act, so no audience-taste fit is shown.`,
  "unresolved-entity": "This act was not matched to a Qloo entity, so no audience-taste fit is shown.",
  "candidate-in-crowd": "This act is already one of the regular-crowd acts, so no audience-taste fit is shown.",
};

export const CAVEAT_WORDING = {
  "single-tag-overlap": "Only one shared audience tag was found, so the overlap with the regular crowd is very thin.",
  "standing-unavailable": "Qloo popularity rank is unavailable for this act or the crowd, so no standing comparison is shown.",
  "low-match-confidence": "You chose this match among several Qloo results. Check the matched name before relying on this result.",
  "thin-data": `Fewer than ${THIN_DATA_CELLS} Qloo heatmap cells back this city, so its strength is thin data.`,
  "city-no-data": "Qloo returned no usable heatmap cells for this city, so no city strength is shown.",
} as const;

/** The thin-data sentence for two or more cities, said once (owner-approved wording, 2026-10-29). One source for the card, the chip and the explanation. */
export const THIN_DATA_WORDING_PLURAL = `Fewer than ${THIN_DATA_CELLS} Qloo heatmap cells back these cities, so their strength is thin data.`;

/** "Berlin", "Berlin and Leipzig", "Berlin, Leipzig and London": city names (untrusted text, plain) joined for a sentence. */
export function joinCityNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

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

/** The caveat codes the act detail shows (M2-02). Each has fixed plain-text wording. */
export const CAVEAT_CODES = ["no_data", "low_match_confidence", "thin_city_data", "standing_not_capacity"] as const;
export type CaveatCode = (typeof CAVEAT_CODES)[number];

/**
 * Fixed templates. `no_data` has several causes (no shared tags, an upstream gap, popularity missing),
 * so its sentence is the core wording already attached to the caveat; the others never vary.
 */
export const CAVEAT_TEMPLATES: Readonly<Record<Exclude<CaveatCode, "no_data">, string>> = {
  low_match_confidence: CAVEAT_WORDING["low-match-confidence"],
  thin_city_data: CAVEAT_WORDING["thin-data"],
  standing_not_capacity: "Qloo popularity rank is a standing on Qloo, not a measure of change over time or room size.",
};

export interface DetailCaveat {
  readonly code: CaveatCode;
  readonly message: string;
  /** Untrusted text (a city string). Render as plain text. */
  readonly subject?: string;
}

const CODE_OF: Readonly<Record<Caveat["type"], CaveatCode>> = {
  "thin-data": "thin_city_data",
  "no-data": "no_data",
  "low-match-confidence": "low_match_confidence",
  "standing-unavailable": "no_data",
  "single-tag-overlap": "no_data",
};

/**
 * Caveats for the act detail: each stored caveat mapped to its code, plus `standing_not_capacity`
 * whenever a Qloo popularity rank is shown (it is a standing, never a capacity claim).
 */
export function detailCaveats(result: { readonly caveats: readonly Caveat[]; readonly standing: unknown }): DetailCaveat[] {
  const out: DetailCaveat[] = result.caveats.map((c) => {
    const code = CODE_OF[c.type];
    const message = code === "no_data" ? c.message : CAVEAT_TEMPLATES[code];
    return c.subject !== undefined ? { code, message, subject: c.subject } : { code, message };
  });
  if (result.standing) out.push({ code: "standing_not_capacity", message: CAVEAT_TEMPLATES.standing_not_capacity });
  return out;
}
