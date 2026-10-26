/**
 * Entity matching (architecture section 2, invariant "an ambiguous match blocks ranking until
 * confirmed"). Pure: it classifies a typed name against the Qloo `/search` hits and never throws.
 * Hit strings are untrusted third-party text; callers render them as plain text.
 */

/** The fields of a Qloo search hit that matching needs. `SearchEntity` from `@headliner/qloo` satisfies it. */
export interface SearchHit {
  readonly entityId: string;
  readonly name: string;
  /** Qloo popularity, 0..1. */
  readonly popularity: number;
  readonly disambiguation?: string | null;
  readonly tags?: readonly { readonly name: string }[];
}

export interface MatchCandidate {
  readonly entityId: string;
  readonly name: string;
  readonly popularity: number;
  /** Up to 3 tag names, to tell same-named artists apart. */
  readonly tags: string[];
  readonly disambiguation: string | null;
}

export type MatchState =
  | { readonly state: "exact"; readonly candidates: readonly [MatchCandidate] }
  | { readonly state: "ambiguous"; readonly candidates: readonly MatchCandidate[] }
  | { readonly state: "none"; readonly candidates: readonly [] };

export const MAX_MATCH_CANDIDATES = 5;
export const MAX_CANDIDATE_TAGS = 3;

/** Match confidence recorded on an `Act` (provisional model, owned by M2-01). */
export const MATCH_CONFIDENCE = {
  /** One result whose normalised name equals the typed name and Qloo ranked it first. */
  exact: 1,
  /** The user picked this entity from several (or from a differently spelled hit). */
  chosenByUser: 0.5,
} as const;

/** NFKC, case-fold, trim, collapse whitespace. Accents are kept: "Bjork" and "Björk" differ. */
export function normaliseMatchName(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/ß/g, "ss").replace(/\s+/gu, " ").trim();
}

function toCandidate(hit: SearchHit): MatchCandidate {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of hit.tags ?? []) {
    const label = tag.name.trim();
    const key = label.toLowerCase();
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    tags.push(label);
    if (tags.length === MAX_CANDIDATE_TAGS) break;
  }
  return { entityId: hit.entityId, name: hit.name, popularity: hit.popularity, tags, disambiguation: hit.disambiguation ?? null };
}

/**
 * `exact`: the first hit's normalised name equals the query and no other hit has that name.
 * `ambiguous`: any other non-empty result (several same-named hits, or the top hit differs).
 * `none`: no hits. At most 5 candidates are returned; the same entity id is listed once.
 */
export function classifyMatch(query: string, results: readonly SearchHit[]): MatchState {
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    const id = r.entityId.toUpperCase();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const first = unique[0];
  if (first === undefined) return { state: "none", candidates: [] };
  const wanted = normaliseMatchName(query);
  const named = unique.filter((r) => normaliseMatchName(r.name) === wanted);
  if (named.length === 1 && named[0] === first) return { state: "exact", candidates: [toCandidate(first)] };
  return { state: "ambiguous", candidates: unique.slice(0, MAX_MATCH_CANDIDATES).map(toCandidate) };
}
