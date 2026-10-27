import type { Fact } from "./facts";

function acts(n: string): string {
  return n === "1" ? "act" : "acts";
}

const STANDING_PHRASE = {
  above: "above",
  similar: "similar to",
  below: "below",
} as const;

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
  for (const fact of facts) {
    const act = fact.kind === "room" ? null : fact.act;
    if (fact.kind === "room" || act !== currentAct) flush();
    currentAct = act;
    current.push(sentenceOf(fact));
  }
  flush();
  return lines.join("\n");
}
