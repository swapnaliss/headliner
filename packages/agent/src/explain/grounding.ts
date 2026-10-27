import { FIT_MIN_SHARED_TAGS, THIN_DATA_CELLS, type Slate } from "@headliner/core";
import { fmt } from "./facts";

/**
 * The grounding check (ADR 0009, ticket M3-02). A text passes only when every number in it, written
 * as digits or as an English number word, is a number the Slate shows (after the rounding the UI
 * uses), and it contains no banned claim. Entity names are stripped first: "Blink-182" is a name,
 * not a figure.
 */

export type Violation =
  | { readonly kind: "number"; readonly token: string }
  | { readonly kind: "banned"; readonly token: string }
  | { readonly kind: "markup"; readonly token: string }
  | { readonly kind: "internal"; readonly token: string }
  | { readonly kind: "name"; readonly token: string }
  | { readonly kind: "claim"; readonly token: string }
  | { readonly kind: "malformed"; readonly token: string };

export type GroundingResult = { readonly ok: true } | { readonly ok: false; readonly violations: readonly Violation[] };

/** Words the product never uses about an act: forecasts, turnout, sales, momentum and trend claims. */
const BANNED: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "forecast", pattern: /\bforecast\w*/i },
  { label: "turnout", pattern: /\bturn[- ]?out\b/i },
  { label: "will sell", pattern: /\bwill\s+sell\b/i },
  { label: "sell out", pattern: /\bsell(?:s|ing)?[- ]out\b/i },
  { label: "ticket sales", pattern: /\bticket\s+sales?\b/i },
  { label: "momentum", pattern: /\bmomentum\b/i },
  { label: "trend", pattern: /\btrend\w*/i },
  { label: "trajectory", pattern: /\btrajector\w*/i },
  { label: "rising", pattern: /\b(?:rising|surging|surges?|skyrocket\w*|growing|growth|breakout)\b/i },
  { label: "predict", pattern: /\b(?:predict\w*|projected|projection)\b/i },
];

/**
 * Internal names must never reach the reader: the Fact and ActResult field names, caveat codes, ids and
 * JSON syntax. Listed from the schemas (facts.ts, core types.ts, caveats.ts), plus any camelCase or snake_case token.
 */
export const INTERNAL_FIELD_NAMES = [
  "sharedTags", "thinData", "crowdActs", "crowdMedian", "crowdSample", "candidatePercentile", "crowdMedianPercentile", "meanAffinityRank",
  "affinity_rank", "overlapTags", "cityStrengths", "evidenceRefs", "qlooEntityId", "matchConfidence", "tagId", "standingExplanation", "deltaPoints",
  "coveredCrowdActs", "closeSpread", "no-data", "no_data", "thin_city_data", "low_match_confidence", "standing_not_capacity", "caveat", "statement", "statements", "sentences", "urn:",
] as const;
const INTERNAL = new RegExp(`(?:${INTERNAL_FIELD_NAMES.map((n) => n.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")).join("|")})`, "i");
/** camelCase or snake_case identifiers, UUIDs and JSON punctuation. */
const CODE_LIKE = /\b[a-z]+[A-Z][A-Za-z]*\b|\b[a-z]+_[a-z_]+\b|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}|[{}]|":/;

/**
 * A number can be a Slate figure and still be attached to the wrong thing ("only 4 heatmap cells" when 4 is the
 * crowd size). Cell counts must be a city's real cell count (or the 15-cell threshold), crowd counts the real crowd size.
 */
function misattributedCounts(text: string, slate: Slate): string[] {
  const cells = new Set<string>([String(THIN_DATA_CELLS), ...slate.results.flatMap((r) => r.cityStrengths.map((c) => String(c.cellCount)))]);
  const bad: string[] = [];
  for (const m of text.matchAll(/(\d+)\s+(?:Qloo\s+)?(?:heatmap\s+)?cells?\b/gi)) if (!cells.has(String(Number(m[1])))) bad.push(m[0]);
  for (const m of text.matchAll(/(\d+)\s+(?:regular[- ]?)?crowd\s+acts?\b/gi)) if (Number(m[1]) !== slate.room.crowdActs.length) bad.push(m[0]);
  return bad;
}

/** Capitalised words allowed besides the Slate's own names: the product name. */
const ALLOWED_CAPITALISED = new Set(["Qloo"]);

/**
 * Any capitalised word that is not the first word of a sentence and not a Slate name (names were stripped
 * first) is a name the Slate does not contain: an invented act, tag or place ("Tokyo-like markets").
 */
function unknownNames(bare: string): string[] {
  const found: string[] = [];
  for (const sentence of bare.split(/[.!?:;]\s+|\n/)) {
    const words = sentence.trim().split(/\s+/).slice(1);
    for (const w of words) {
      const m = /^[("'\u2018\u201C]*([A-Z][A-Za-z\u00C0-\u017F]*)/.exec(w);
      if (m?.[1] && !ALLOWED_CAPITALISED.has(m[1])) found.push(m[1]);
    }
  }
  return found;
}

/** HTML, markdown and links have no place in an explanation (it is rendered as plain text anyway). */
const MARKUP = /<[^>]*>|[<>`]|\]\(|https?:|www\.|\*\*|^#+\s|^\s*[-*]\s/m;

const UNITS: Readonly<Record<string, number>> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12,
};
const TENS: Readonly<Record<string, number>> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const BIG: Readonly<Record<string, number>> = { hundred: 100, thousand: 1000, million: 1_000_000 };
const NUMBER_WORD = new RegExp(`\\b(?:${[...Object.keys(UNITS), ...Object.keys(TENS), ...Object.keys(BIG), "half", "twice", "double", "triple", "dozen"].join("|")})\\b`, "i");
const WORD = /[A-Za-z]+/g;

/** Canonical form of a numeric string: "60.0" and "60" are the same figure. */
function canon(raw: string): string | null {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? String(value) : null;
}

function numbersIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const c = canon(m[0]);
    if (c !== null) out.push(c);
  }
  return out;
}

/** The set of figures a Slate shows, in the UI's rounding, plus the scale "100". */
export function allowedNumbers(slate: Slate): Set<string> {
  const allowed = new Set<string>(["100"]);
  const add = (raw: string | number | null | undefined): void => {
    if (raw === null || raw === undefined) return;
    const c = canon(String(raw));
    if (c !== null) allowed.add(c);
  };
  const addText = (text: string | undefined): void => {
    if (text) for (const n of numbersIn(text)) allowed.add(n);
  };
  add(slate.room.crowdActs.length);
  add(slate.results.length);
  const scored = slate.results.filter((r) => r.rank !== null && r.fit !== null);
  add(scored.length);
  add(slate.results.length - scored.length);
  const values = scored.flatMap((r) => (r.fit ? [r.fit.value] : []));
  if (values.length >= 2) add(fmt.one(Math.max(...values) - Math.min(...values)));
  for (const note of slate.notes) addText(note.message);
  for (const r of slate.results) {
    if (r.rank !== null) add(r.rank);
    if (r.fit) {
      add(fmt.one(r.fit.value));
      add(r.fit.sharedTags);
    }
    for (const t of r.overlapTags) {
      add(fmt.two(t.score));
      add(t.coveredCrowdActs);
    }
    if (r.standing) {
      add(fmt.one(r.standing.candidatePercentile));
      add(fmt.one(r.standing.crowdMedianPercentile));
      add(fmt.one(r.standing.deltaPoints));
      add(r.standing.crowdSample);
    }
    for (const c of r.cityStrengths) {
      add(fmt.three(c.meanAffinityRank));
      add(c.cellCount);
    }
    for (const c of r.caveats) addText(c.message);
  }
  // The fixed caveat wording is shown beside the numbers it states ("fewer than 15 cells").
  add(THIN_DATA_CELLS);
  add(FIT_MIN_SHARED_TAGS);
  return allowed;
}

/** Every name the Slate contains: it can hold digits that are not figures. */
function namesIn(slate: Slate): string[] {
  const names = new Set<string>([slate.room.city]);
  for (const a of slate.room.crowdActs) names.add(a.name);
  for (const n of slate.notes) if (n.subject) names.add(n.subject);
  for (const r of slate.results) {
    names.add(r.act.name);
    for (const t of r.overlapTags) names.add(t.name);
    for (const c of r.cityStrengths) names.add(c.city);
    for (const c of r.caveats) if (c.subject) names.add(c.subject);
  }
  return [...names].filter((n) => n.length > 0).sort((a, b) => b.length - a.length);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripNames(text: string, names: readonly string[]): string {
  let out = text;
  for (const name of names) out = out.replace(new RegExp(escapeRegExp(name), "gi"), " ");
  return out;
}

/** Value of a run of number words ("seventy-four", "twenty one", "third"), or null when the word is not a figure. */
function wordValue(words: readonly string[]): number | null {
  let total = 0;
  let current = 0;
  for (const w of words) {
    const key = w.toLowerCase();
    if (key in UNITS) current += UNITS[key] ?? 0;
    else if (key in TENS) current += TENS[key] ?? 0;
    else if (key in BIG) {
      current = (current === 0 ? 1 : current) * (BIG[key] ?? 1);
      total += current;
      current = 0;
    } else return null; // half, twice, dozen...: a quantity the Slate never shows
  }
  return total + current;
}

function wordNumbers(text: string): { token: string; canon: string | null }[] {
  const out: { token: string; canon: string | null }[] = [];
  const words = [...text.matchAll(WORD)].map((m) => m[0]);
  let run: string[] = [];
  const flush = (): void => {
    if (run.length === 0) return;
    const value = wordValue(run);
    out.push({ token: run.join(" "), canon: value === null ? null : String(value) });
    run = [];
  };
  for (const w of words) {
    if (NUMBER_WORD.test(w)) run.push(w);
    else flush();
  }
  flush();
  return out;
}

/** Checks `text` against `slate`. Returns every violation found, so tests and evals can see why. */
export function groundingCheck(text: string, slate: Slate, options: { readonly dataLimitsStated?: boolean } = {}): GroundingResult {
  const violations: Violation[] = [];
  const bare = stripNames(text, namesIn(slate));
  const allowed = allowedNumbers(slate);

  for (const token of bare.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const c = canon(token[0]);
    if (c === null || !allowed.has(c)) violations.push({ kind: "number", token: token[0] });
  }
  for (const w of wordNumbers(bare)) {
    // A word figure must be a Slate figure too ("one of the acts" passes only because 1 is shown, e.g. as a rank).
    if (w.canon === null || !allowed.has(w.canon)) violations.push({ kind: "number", token: w.token });
  }
  for (const b of BANNED) {
    const m = b.pattern.exec(bare);
    if (m) violations.push({ kind: "banned", token: m[0] });
  }
  const internal = INTERNAL.exec(bare) ?? CODE_LIKE.exec(bare);
  if (internal) violations.push({ kind: "internal", token: internal[0] });
  for (const token of unknownNames(bare)) violations.push({ kind: "name", token });
  for (const token of misattributedCounts(text, slate)) violations.push({ kind: "claim", token });
  // Thin, limited or missing data may be claimed only when the facts in scope state a limit (the caller says so; default: any).
  if (options.dataLimitsStated === false) {
    const limit = /\b(?:thin|limited|missing|sparse|incomplete|unreliable)\b/i.exec(bare);
    if (limit) violations.push({ kind: "claim", token: limit[0] });
  }
  const gap = /\S {2,}\S/.exec(text);
  if (gap) violations.push({ kind: "malformed", token: "double space" });
  const markup = MARKUP.exec(text);
  if (markup) violations.push({ kind: "markup", token: markup[0] });
  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}
