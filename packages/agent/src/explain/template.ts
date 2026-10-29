import { CAVEAT_WORDING, THIN_DATA_WORDING_PLURAL, joinCityNames } from "@headliner/core";
import type { Fact } from "./facts";

function acts(n: string): string {
  return n === "1" ? "act" : "acts";
}

const STANDING_PHRASE = {
  above: "above",
  similar: "similar to",
  below: "below",
} as const;

/**
 * Says the thin-data caveat once per act. Two or more thin cities of one act become a single caveat fact whose subject is
 * the cities ("Berlin and Leipzig") and whose message is core's plural sentence; one thin city is left exactly as it is.
 * The merged fact sits where the first thin-city caveat was. Only Slate fields (city names, the 15-cell threshold) are used.
 */
export function mergeThinCaveats(facts: readonly Fact[]): Fact[] {
  const isThin = (f: Fact): f is Extract<Fact, { kind: "caveat" }> => f.kind === "caveat" && f.subject !== undefined && f.message === CAVEAT_WORDING["thin-data"];
  const out: Fact[] = [];
  for (const fact of facts) {
    if (!isThin(fact)) {
      out.push(fact);
      continue;
    }
    const same = facts.filter((f) => isThin(f) && f.act === fact.act);
    if (same.length < 2) {
      out.push(fact);
    } else if (same[0] === fact) {
      out.push({ kind: "caveat", act: fact.act, message: THIN_DATA_WORDING_PLURAL, subject: joinCityNames(same.map((f) => (f as { subject: string }).subject)) });
    }
  }
  return out;
}

/** One deterministic sentence per fact. Pure: the same facts always give the same text. */
export function sentenceOf(fact: Fact): string {
  switch (fact.kind) {
    case "room":
      return [
        `Audience-taste fit compares ${fact.scored} of ${fact.candidates} candidate ${acts(fact.candidates)} with the ${fact.crowdActs} regular-crowd ${acts(fact.crowdActs)} for ${fact.city}.`,
        fact.unscored !== "0" ? `${fact.unscored} could not be scored.` : "",
        fact.closeSpread !== undefined ? `Fit values span ${fact.closeSpread} points, so neighbouring ranks are close.` : "",
      ]
        .filter(Boolean)
        .join(" ");
    case "fit":
      return `${fact.act} ranks ${fact.rank} with an audience-taste fit of ${fact.fit} out of 100, from ${fact.sharedTags} shared audience ${fact.sharedTags === "1" ? "tag" : "tags"}.`;
    case "tastes":
      return `Its strongest shared tastes are ${fact.tags.map((t) => `${t.name} (score ${t.score})`).join(", ")}.`;
    case "standing":
      return `${fact.caption}: ${fact.act} sits at ${fact.candidate} of 100 against a crowd median of ${fact.crowdMedian} across ${fact.crowdSample} crowd ${acts(fact.crowdSample)}, ${STANDING_PHRASE[fact.label]} the crowd.`;
    case "city":
      return `In ${fact.city}, ${fact.act} has a mean affinity rank of ${fact.meanAffinityRank} across ${fact.cells} heatmap ${fact.cells === "1" ? "cell" : "cells"}.`;
    case "caveat":
      return fact.subject !== undefined ? `${fact.subject}: ${fact.message}` : fact.message;
    case "no-data":
      return `${fact.act} could not be scored. ${fact.reason}`;
  }
}

/**
 * The always-available explanation. Lines are separated by "\n": the room line first, then one
 * line per act with its sentences in the order the facts came. Contains only numbers from the facts.
 */
export function renderTemplate(facts: readonly Fact[]): string {
  const lines: string[] = [];
  let current: string[] = [];
  let currentAct: string | null = null;
  const flush = (): void => {
    if (current.length > 0) lines.push(current.join(" "));
    current = [];
  };
  for (const fact of mergeThinCaveats(facts)) {
    const act = fact.kind === "room" ? null : fact.act;
    if (fact.kind === "room" || act !== currentAct) flush();
    currentAct = act;
    current.push(sentenceOf(fact));
  }
  flush();
  return lines.join("\n");
}
