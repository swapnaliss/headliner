import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ActResult, CompareTag, FitResult, HeatmapCell } from "../src";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "fixtures", "qloo");

/** Body of a recorded Qloo fixture (fixtures/qloo, M0-02). */
export function loadBody<T>(file: string): T {
  return (JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as { body: T }).body;
}

export function tag(id: string, score: number, acts: readonly string[] = ["A"]): CompareTag {
  return { tag_id: id, query: { score, "a.signal.interests.entities": acts.map((entity_id) => ({ entity_id })) } };
}
export function tags(n: number, score = 0.6): CompareTag[] {
  return Array.from({ length: n }, (_, i) => tag(`t${i}`, score));
}
export function cells(n: number, rank = 0.5): HeatmapCell[] {
  return Array.from({ length: n }, () => ({ query: { affinity_rank: rank } }));
}
export function okFit(result: FitResult): number {
  if (result.status !== "ok") throw new Error(`expected ok, got ${result.reason}`);
  return result.fit;
}

export const compareTags = (file: string): CompareTag[] =>
  loadBody<{ results: { tags: CompareTag[] } }>(file).results.tags;
export const heatmapCells = (file: string): HeatmapCell[] =>
  loadBody<{ results: { heatmap: HeatmapCell[] } }>(file).results.heatmap;
export const popularityOf = (slug: string): number | undefined =>
  loadBody<{ results: { popularity?: number }[] }>(`search--${slug}.json`).results[0]?.popularity;

export const CROWD_SLUGS = ["apparat", "moderat", "modeselektor", "hundreds", "brandt-brauer-frick", "boys-noize"];
export const crowdPopularity = (): (number | undefined)[] => CROWD_SLUGS.map(popularityOf);

/** A minimal ActResult for ranking and invariant tests. */
export function actResult(
  id: string,
  name: string,
  fit: number | null,
  percentile: number | null = null,
): ActResult {
  return {
    act: { qlooEntityId: id, name, matchConfidence: 1 },
    status: fit === null ? "no-data" : "scored",
    rank: null,
    fit: fit === null ? null : { value: fit, sharedTags: 5, evidenceRefs: ["e1"] },
    overlapTags: [],
    standing:
      percentile === null
        ? null
        : {
            caption: "Qloo popularity rank",
            candidatePercentile: percentile,
            crowdMedianPercentile: 50,
            crowdSample: 3,
            deltaPoints: percentile - 50,
            label: "similar",
            evidenceRefs: ["e1"],
          },
    cityStrengths: [],
    caveats: [],
    evidence: [
      { id: "e1", endpoint: "/v2/insights/compare", redactedParams: { "filter.type": "urn:entity:artist" }, responseDigest: "abc", fetchedAt: "2026-10-26T00:00:00.000Z" },
    ],
  };
}
