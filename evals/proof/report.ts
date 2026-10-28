// Deterministic Markdown for the two evidence files. Everything comes from the set files, the recorded
// fixtures and the committed run log; no clock, no randomness, so replay reproduces the files byte for byte.
import type { LoadedSets, RunLog } from "./common";
import type { CandidateRow, FitSanityResult } from "./fit-sanity";
import type { CityRow, HomeCityResult } from "./home-city";

const BANNER = "> Aggregate affinity, not a ticket forecast.";
const cell = (s: string): string => s.replace(/\|/g, "/");
const f3 = (n: number | null): string => (n === null ? "n/a" : n.toFixed(3));
const yn = (b: boolean | null): string => (b === null ? "n/a" : b ? "yes" : "no");

function runLogSection(log: RunLog): string {
  const status = Object.entries(log.statusCounts)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([s, n]) => `${s} x ${n}`)
    .join(", ");
  const rows = log.byEndpoint.map((e) => `| \`${e.endpoint}\` | ${e.calls} | ${e.medianMs} | ${e.p95Ms} | ${e.maxMs} |`).join("\n");
  return [
    "## Live recording run",
    "",
    `Recorded ${log.recordedAt.slice(0, 10)} (one workstation, one network path) through the adapter (\`@headliner/qloo\` ${log.adapterVersion}) at a concurrency cap of ${log.maxConcurrent}, against \`hackathon.api.qloo.com\`. Every 200 response was stored in \`fixtures/qloo/proof/\`; replay needs no key.`,
    "",
    `- Live calls: ${log.liveCalls} (status codes: ${status}); adapter retries: ${log.retries}; HTTP 429 responses: ${log.rateLimited429}.`,
    `- Wall time: ${log.wallSeconds} s.`,
    "",
    "| Endpoint | Calls | Median ms | p95 ms | Max ms |",
    "|---|---|---|---|---|",
    rows,
    "",
    "Quota notes and the earlier latency measurements are in `docs/evidence/qloo-latency.md` (the daily quota is not observable from responses).",
  ].join("\n");
}

function supplementSection(log: RunLog): string {
  const status = Object.entries(log.statusCounts)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, n]) => `${k} x ${n}`)
    .join(", ");
  const rows = log.byEndpoint.map((e) => `| \`${e.endpoint}\` | ${e.calls} | ${e.medianMs} | ${e.p95Ms} | ${e.maxMs} |`).join("\n");
  return [
    `### Supplementary recording ${log.recordedAt.slice(0, 10)}`,
    "",
    `Heatmaps for one act (Rich Brian) recorded later through the same adapter and recorder at a concurrency cap of ${log.maxConcurrent}; his search was already recorded and was replayed, not re-requested. No earlier fixture was changed.`,
    "",
    `- Live calls: ${log.liveCalls} (status codes: ${status}); adapter retries: ${log.retries}; HTTP 429 responses: ${log.rateLimited429}.`,
    `- Wall time: ${log.wallSeconds} s.`,
    "",
    "| Endpoint | Calls | Median ms | p95 ms | Max ms |",
    "|---|---|---|---|---|",
    rows,
  ].join("\n");
}

function cityCell(c: CityRow | undefined): string {
  if (!c) return "n/a";
  if (c.status === "no_data") return `no data (${c.reason ?? "error"})`;
  return c.meanAffinityRank === null ? `no cells` : `${f3(c.meanAffinityRank)} (${c.cellCount})${c.thin ? " thin" : ""}`;
}

export function renderHomeCity(r: HomeCityResult, sets: LoadedSets, log: RunLog, supplements: readonly RunLog[] = []): string {
  const s = r.summary;
  const set = sets.homeCity;
  const resolved = r.acts.filter((a) => a.resolution.status === "resolved" && a.cities.some((c) => c.status === "ok"));
  const out: string[] = [
    "# Home-city check (measured)",
    "",
    BANNER,
    "",
    `Set file: \`evals/proof/home-city-set.json\`, sha256 \`${sets.homeCityDigest}\` (chosen ${set.chosenOn}, before any heatmap for these acts was requested). A test fails if the set is edited without regenerating this file.`,
    "",
    "## Question",
    "",
    "For an act with a documented home city, is that city the one where Qloo's heatmap for the act has the highest mean `affinity_rank` among the cities in the set? Qloo rescales heatmap `affinity` and `popularity` inside each city, so cities are compared only by mean `affinity_rank` and by the number of cells behind it (ADR 0013). A city with fewer than 15 cells is flagged thin and still listed.",
    "",
    "## Result",
    "",
    `- Acts listed: ${s.listed}; resolved to a Qloo entity: ${s.resolved}; unresolved: ${s.unresolved}${s.notMeasured > 0 ? `; resolved but no heatmap recorded (not measured, neither hit nor miss): ${s.notMeasured}` : ""}. Cities in the set: ${set.cities.length} (${set.cities.join(", ")}); home cities: ${s.cityCount}; continents: ${s.continentCount}.`,
    `- Home city has the highest mean \`affinity_rank\` among all cities in the set (thin cities included, flagged): **${s.hits} of ${s.measured}** resolved acts.`,
    `- Stricter reading (home city has at least 15 cells and is highest among cities with at least 15 cells): **${s.hitsEnoughData} of ${s.measured}** resolved acts.`,
    `- Resolved acts whose own home-city heatmap is thin (under 15 cells): ${s.homeCityThin} of ${s.measured}. Resolved acts with at least one thin city in the set: ${s.actsWithAnyThinCity} of ${s.measured}.`,
    "",
    "Regenerated after the search-schema fix: the hit counts stayed 11 of 14 because the one resolved act with no recorded heatmap was not counted. Its recorded search lacked a `popularity` key, which the adapter rejected when the proof was recorded, so its heatmaps were never requested. The fix made it resolvable; recording its heatmaps needed a live run that was not made at that time.",
    "",
    "Rich Brian's heatmaps recorded 2026-10-28; sample is now 15 acts.",
    "",
    "No pass or fail line is applied to these counts. The sample is small and was chosen by hand; read the counts with every row below.",
    "",
    "## Every act",
    "",
    "| Act | Home city | Continent | Strongest city | Home city rank | Hit | Hit (enough data) |",
    "|---|---|---|---|---|---|---|",
    ...r.acts.map((a) =>
      a.resolution.status === "resolved" && !a.cities.some((c) => c.status === "ok")
        ? `| ${cell(a.name)} | ${a.homeCity} | ${a.continent} | resolved, no heatmap recorded (not measured) | n/a | n/a | n/a |`
        : a.resolution.status === "resolved"
        ? `| ${cell(a.name)} | ${a.homeCity} | ${a.continent} | ${a.strongestCity ?? "n/a"} | ${a.homeRank ?? "n/a"} of ${a.cities.filter((c) => c.meanAffinityRank !== null).length} | ${yn(a.hit)} | ${yn(a.hitEnoughData)} |`
        : `| ${cell(a.name)} | ${a.homeCity} | ${a.continent} | unresolved (${cell(a.resolution.reason)}) | n/a | n/a | n/a |`,
    ),
    "",
    "## Mean affinity_rank (cell count) per city",
    "",
    "The home city is marked with an asterisk. `thin` = fewer than 15 cells.",
    "",
    `| Act | ${set.cities.join(" | ")} |`,
    `|---|${set.cities.map(() => "---").join("|")}|`,
    ...resolved.map(
      (a) => `| ${cell(a.name)} | ${set.cities.map((city) => `${cityCell(a.cities.find((c) => c.city === city))}${city === a.homeCity ? " *" : ""}`).join(" | ")} |`,
    ),
    "",
    "## Home cities and sources",
    "",
    "| Act | Home city | Source for the home city | Matched Qloo entity |",
    "|---|---|---|---|",
    ...r.acts.map((a) => `| ${cell(a.name)} | ${a.homeCity} | ${cell(a.source)} | ${a.resolution.status === "resolved" ? cell(a.resolution.matchedName) : "unresolved"} |`),
    "",
    "## Method",
    "",
    `1. Resolve each act with \`GET /search\`. Rule, fixed in the set file: ${cell(set.resolutionRule)} Unresolved acts are listed with the reason and are not replaced.`,
    "2. For each resolved act and each city of the set: `GET /v2/insights` with `filter.type=urn:heatmap`, `filter.location.query=<city>`, `signal.interests.entities=<entity id>`; the adapter asserts the response shape and reduces the grid to cell count and mean `affinity_rank`; `cityStrengthFromAggregate` (core) rounds to three decimals and sets the thin flag.",
    "3. Order cities by mean `affinity_rank` (ties: more cells, then name). Hit = the home city is first.",
    "",
    "## Limits",
    "",
    `- Small hand-picked sample (${s.listed} acts, ${set.cities.length} cities); no confidence interval is claimed.`,
    "- The city is a free-text query to Qloo; a name shared by several places is resolved by Qloo, not by us.",
    "- Mean `affinity_rank` is relative inside each city's own rescaled grid. A city with few cells has a mean over few cells; the thin flag exists for that reason.",
    "- Qloo popularity may favour well-known acts and large cities; this run does not separate that effect from taste.",
    "- Home city is where the act is documented to be from or formed; it says nothing about where its listeners live.",
    "",
    runLogSection(log),
    "",
    ...supplements.flatMap((x) => [supplementSection(x), ""]),
  ];
  return out.join("\n");
}

function margin(x: CandidateRow, control: CandidateRow): string {
  if (x.role === "control" || x.fit === null || control.fit === null) return "n/a";
  const d = Math.round((x.fit - control.fit) * 10) / 10;
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}`;
}

function fitCell(c: CandidateRow): string {
  return c.fit === null ? `unavailable (${cell(c.unavailableReason ?? "unknown")})` : c.fit.toFixed(1);
}

export function renderFit(r: FitSanityResult, sets: LoadedSets, log: RunLog): string {
  const s = r.summary;
  const out: string[] = [
    "# Fit sanity test (measured)",
    "",
    BANNER,
    "",
    `Set file: \`evals/proof/fit-set.json\`, sha256 \`${sets.fitDigest}\` (chosen ${sets.fit.chosenOn}, before any compare for these acts was requested). A test fails if the set is edited without regenerating this file.`,
    "",
    "## Question",
    "",
    "For a known crowd, does each same-genre candidate get a higher audience-taste fit (Fit, ADR 0013) than one clearly off-genre control? This is a sanity check of the formula on real Qloo responses, not a claim about any venue.",
    "",
    "## Result",
    "",
    `- Crowds: ${s.crowdCount}; same-genre candidates: ${s.sameGenreCandidates}; comparable with their control: ${s.comparable}.`,
    `- Same-genre candidates with a higher Fit than their crowd's control: **${s.outranking} of ${s.comparable}**.`,
    "",
    ...r.crowds.map((c) => `- ${c.id}: ${c.outranking} of ${c.comparable} same-genre candidates outrank the control (${c.control.name}, Fit ${fitCell(c.control)}).`),
    "",
    "No pass or fail line is applied. A miss is shown as a miss, and the Fit formula was not changed after seeing these numbers.",
    "",
    "## Every crowd",
    "",
    ...r.crowds.flatMap((c) => [
      `### ${c.id}: ${c.description}`,
      "",
      `Crowd (${c.crowd.length} acts, one list compare per candidate with the whole crowd on side A): ${c.crowd.map((a) => `${cell(a.name)}${a.resolved ? "" : " (unresolved)"}`).join(", ")}.`,
      "",
      "| Candidate | Role | Fit | Fit minus control | Shared tags | Higher than control |",
      "|---|---|---|---|---|---|",
      ...[...c.candidates, c.control].map(
        (x) => `| ${cell(x.name)} | ${x.role} | ${fitCell(x)} | ${margin(x, c.control)} | ${x.sharedTags ?? "n/a"} | ${x.role === "control" ? "n/a" : yn(x.outranksControl)} |`,
      ),
      "",
    ]),
    "## Method",
    "",
    "1. Resolve every name with `/search` as in the home-city check.",
    "2. One `GET /v2/insights/compare` per candidate with the crowd's entity ids on `a.signal.interests.entities` and the candidate on `b.signal.interests.entities`, `filter.type=urn:entity:artist`.",
    "3. Fit = core `computeFit` over `results.tags` (de-duplicated by tag, mean of chosen scores x 100, one decimal). Unavailable results are shown as unavailable, never as zero.",
    "4. Higher than control = strictly greater Fit.",
    "",
    "## Limits",
    "",
    `- ${s.crowdCount} crowds with 3 to 6 acts each and hand-picked candidates; genre labels are the author's, not Qloo's.`,
    "- Fit values sit in a narrow band (Qloo tag scores are compressed, ADR 0013), so differences of a point or two should not be over-read.",
    "- The control is one act per crowd; a single off-genre act cannot represent every off-genre act.",
    "- Candidate popularity may influence Qloo's tag scores; this run does not separate that effect.",
    "",
    runLogSection(log),
    "",
  ];
  return out.join("\n");
}
