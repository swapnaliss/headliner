// Offline sanity check of the ADR 0013 scoring functions against the recorded Qloo fixtures
// (fixtures/qloo, M0-02). No network, no key, no database. Output is deterministic.
// Run: npx tsx scripts/fit-sanity.ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeCityStrength,
  computeFit,
  computeStanding,
  type CompareTag,
  type HeatmapCell,
} from "../packages/core/src";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "qloo");

function load<T>(file: string): T {
  return (JSON.parse(readFileSync(join(DIR, file), "utf8")) as { body: T }).body;
}

interface SearchBody {
  results: { name: string; entity_id: string; popularity?: number }[];
}
interface CompareBody {
  results: { tags: CompareTag[]; b: { tag_id: string }[] };
}
interface HeatmapBody {
  results: { heatmap: HeatmapCell[] };
}

const first = (slug: string) => {
  const hit = load<SearchBody>(`search--${slug}.json`).results[0];
  if (!hit) throw new Error(`no search hit in search--${slug}.json`);
  return hit;
};

const crowd = ["apparat", "moderat", "modeselektor", "hundreds", "brandt-brauer-frick", "boys-noize"].map(first);
const candidates = [
  { slug: "khruangbin", compare: "compare--list6-crowd-vs-khruangbin.json" },
  { slug: "radiohead", compare: "compare--list6-crowd-vs-radiohead.json" },
  { slug: "reality-club", compare: "compare--list6-crowd-vs-reality-club.json" },
].map((c) => ({ ...c, hit: first(c.slug), body: load<CompareBody>(c.compare) }));

// Alternatives for the per-tag repeat rule, shown only as evidence for the ADR. Not product code.
function alternative(tags: readonly CompareTag[], pick: "max" | "mean" | "raw"): number {
  if (pick === "raw") return (100 * tags.reduce((s, t) => s + t.query.score, 0)) / tags.length;
  const byTag = new Map<string, number[]>();
  for (const t of tags) byTag.set(t.tag_id, [...(byTag.get(t.tag_id) ?? []), t.query.score]);
  const per = [...byTag.values()].map((v) => (pick === "max" ? Math.max(...v) : v.reduce((s, x) => s + x, 0) / v.length));
  return (100 * per.reduce((s, x) => s + x, 0)) / per.length;
}
const f1 = (n: number) => n.toFixed(1);
const pad = (s: string, n: number) => s.padEnd(n);

console.log("# fit-sanity (ADR 0013), recorded fixtures only");
console.log(`crowd (${crowd.length} acts, one list compare per candidate): ${crowd.map((c) => c.name).join(", ")}`);
console.log(`candidates (${candidates.length}): ${candidates.map((c) => c.hit.name).join(", ")}`);
console.log("");

const ranked = candidates
  .map((c) => ({ entityId: c.hit.entity_id, name: c.hit.name, fit: computeFit(c.body.results.tags) }))
  .sort((a, b) => (b.fit.status === "ok" ? b.fit.fit : -1) - (a.fit.status === "ok" ? a.fit.fit : -1) || (a.name < b.name ? -1 : 1))
  .map((r, index) => ({ ...r, rank: index + 1 }));
console.log("## Fit and standing");
console.log(
  [pad("rank", 5), pad("candidate", 14), pad("fit", 6), pad("tags", 6), pad("standing", 22), "alt: max / mean / raw"].join(" "),
);
for (const r of ranked) {
  const c = candidates.find((x) => x.hit.entity_id === r.entityId);
  if (!c) continue;
  const standing = computeStanding(c.hit.popularity, crowd.map((a) => a.popularity));
  const standingText =
    standing.status === "ok"
      ? `${f1(standing.candidatePercentile)} vs ${f1(standing.crowdMedianPercentile)} ${standing.label}`
      : standing.reason;
  const tags = c.body.results.tags;
  console.log(
    [
      pad(String(r.rank), 5),
      pad(r.name, 14),
      pad(r.fit.status === "ok" ? f1(r.fit.fit) : r.fit.reason, 6),
      pad(r.fit.status === "ok" ? String(r.fit.sharedTags) : "-", 6),
      pad(standingText, 22),
      `${f1(alternative(tags, "max"))} / ${f1(alternative(tags, "mean"))} / ${f1(alternative(tags, "raw"))}`,
    ].join(" "),
  );
}
const fits = ranked.flatMap((r) => (r.fit.status === "ok" ? [r.fit.fit] : []));
console.log(`spread of Fit across the ${fits.length} candidates: ${f1(Math.max(...fits) - Math.min(...fits))} points`);
console.log("");

console.log("## Same-genre control check");
const crowdGenre = "urn:tag:genre:music:electronic";
for (const c of candidates) {
  const has = c.body.results.b.some((t) => t.tag_id === crowdGenre);
  console.log(`${pad(c.hit.name, 14)} candidate-side tags include Electronic (crowd genre): ${has ? "yes" : "no"}`);
}
console.log("No candidate in the recording is an electronic act like the crowd (Radiohead only carries the");
console.log("tag among 35), so same-genre-outranks-off-genre cannot be evaluated here. Not tuned to fit.");
console.log("");

console.log("## City strength (Apparat heatmaps; compare mean affinity_rank and cell count only)");
const cities = ["london", "berlin", "leipzig", "reykjavik", "jakarta", "mumbai", "lagos", "tromso"];
console.log([pad("city", 10), pad("cells", 6), pad("mean rank", 10), "thin-data"].join(" "));
for (const city of cities) {
  const s = computeCityStrength(load<HeatmapBody>(`heatmap--apparat-${city}.json`).results.heatmap);
  console.log(
    s.status === "ok"
      ? [pad(city, 10), pad(String(s.cellCount), 6), pad(s.meanAffinityRank.toFixed(3), 10), s.thinData ? "yes" : "no"].join(" ")
      : [pad(city, 10), s.reason].join(" "),
  );
}
