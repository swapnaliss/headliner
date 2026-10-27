# Home-city check (measured)

> Aggregate affinity, not a ticket forecast.

Set file: `evals/proof/home-city-set.json`, sha256 `f8cd781a2bf52f761689c4ed35b8f5cd0d3bb276e7d140778a0f81d34f13c362` (chosen 2026-10-27, before any heatmap for these acts was requested). A test fails if the set is edited without regenerating this file.

## Question

For an act with a documented home city, is that city the one where Qloo's heatmap for the act has the highest mean `affinity_rank` among the cities in the set? Qloo rescales heatmap `affinity` and `popularity` inside each city, so cities are compared only by mean `affinity_rank` and by the number of cells behind it (ADR 0013). A city with fewer than 15 cells is flagged thin and still listed.

## Result

- Acts listed: 15; resolved to a Qloo entity: 15; unresolved: 0; resolved but no heatmap recorded (not measured, neither hit nor miss): 1. Cities in the set: 5 (London, Berlin, Lagos, Jakarta, Seoul); home cities: 5; continents: 3.
- Home city has the highest mean `affinity_rank` among all cities in the set (thin cities included, flagged): **11 of 14** resolved acts.
- Stricter reading (home city has at least 15 cells and is highest among cities with at least 15 cells): **11 of 14** resolved acts.
- Resolved acts whose own home-city heatmap is thin (under 15 cells): 0 of 14. Resolved acts with at least one thin city in the set: 5 of 14.

Regenerated after the search-schema fix: the hit counts stay 11 of 14 because the one resolved act with no recorded heatmap is not counted. Its recorded search lacked a `popularity` key, which the adapter rejected when the proof was recorded, so its heatmaps were never requested. The fix makes it resolvable; recording its heatmaps needs a live run that was not made.

No pass or fail line is applied to these counts. The sample is small and was chosen by hand; read the counts with every row below.

## Every act

| Act | Home city | Continent | Strongest city | Home city rank | Hit | Hit (enough data) |
|---|---|---|---|---|---|---|
| Stormzy | London | Europe | London | 1 of 5 | yes | yes |
| Adele | London | Europe | London | 1 of 5 | yes | yes |
| Dua Lipa | London | Europe | London | 1 of 5 | yes | yes |
| Modeselektor | Berlin | Europe | Berlin | 1 of 5 | yes | yes |
| Seeed | Berlin | Europe | Berlin | 1 of 5 | yes | yes |
| Rammstein | Berlin | Europe | Berlin | 1 of 5 | yes | yes |
| Wizkid | Lagos | Africa | Lagos | 1 of 5 | yes | yes |
| Tems | Lagos | Africa | Lagos | 1 of 5 | yes | yes |
| Odunsi (The Engine) | Lagos | Africa | Lagos | 1 of 5 | yes | yes |
| Hindia | Jakarta | Asia | Jakarta | 1 of 5 | yes | yes |
| Reality Club | Jakarta | Asia | Jakarta | 1 of 5 | yes | yes |
| Rich Brian | Jakarta | Asia | resolved, no heatmap recorded (not measured) | n/a | n/a | n/a |
| BTS | Seoul | Asia | Jakarta | 2 of 5 | no | no |
| BLACKPINK | Seoul | Asia | Jakarta | 2 of 5 | no | no |
| IU | Seoul | Asia | Jakarta | 2 of 5 | no | no |

## Mean affinity_rank (cell count) per city

The home city is marked with an asterisk. `thin` = fewer than 15 cells.

| Act | London | Berlin | Lagos | Jakarta | Seoul |
|---|---|---|---|---|---|
| Stormzy | 0.974 (2475) * | 0.546 (322) | 0.592 (610) | 0.176 (186) | 0.181 (283) |
| Adele | 0.920 (2603) * | 0.683 (875) | 0.566 (963) | 0.814 (930) | 0.285 (4874) |
| Dua Lipa | 0.823 (2461) * | 0.583 (771) | 0.411 (749) | 0.782 (937) | 0.282 (5843) |
| Modeselektor | 0.678 (667) | 0.900 (512) * | 0.349 (3) thin | 0.349 (53) | 0.361 (99) |
| Seeed | 0.287 (118) | 0.911 (497) * | 0.413 (1) thin | 0.229 (2) thin | 0.238 (3) thin |
| Rammstein | 0.413 (775) | 0.819 (705) * | 0.177 (8) thin | 0.239 (224) | 0.190 (188) |
| Wizkid | 0.509 (1910) | 0.257 (341) | 0.812 (1326) * | 0.128 (355) | 0.082 (503) |
| Tems | 0.428 (883) | 0.199 (134) | 0.813 (1029) * | 0.157 (48) | 0.134 (42) |
| Odunsi (The Engine) | 0.269 (1927) | 0.105 (354) | 0.816 (1337) * | 0.057 (390) | 0.033 (516) |
| Hindia | 0.107 (91) | 0.057 (17) | 0.180 (1) thin | 0.840 (848) * | 0.271 (72) |
| Reality Club | 0.108 (44) | 0.086 (6) thin | 0.082 (1) thin | 0.780 (686) * | 0.387 (32) |
| BTS | 0.331 (1192) | 0.318 (364) | 0.172 (238) | 0.802 (906) | 0.390 (6620) * |
| BLACKPINK | 0.312 (1180) | 0.291 (355) | 0.146 (223) | 0.867 (931) | 0.398 (7238) * |
| IU | 0.297 (1110) | 0.285 (340) | 0.149 (286) | 0.839 (928) | 0.828 (13756) * |

## Home cities and sources

| Act | Home city | Source for the home city | Matched Qloo entity |
|---|---|---|---|
| Stormzy | London | Wikipedia 'Stormzy': born and raised in South London (Thornton Heath) | Stormzy |
| Adele | London | Wikipedia 'Adele': born in Tottenham, London | Adele |
| Dua Lipa | London | Wikipedia 'Dua Lipa': born in London | Dua Lipa |
| Modeselektor | Berlin | Wikipedia 'Modeselektor': Berlin electronic duo | Modeselektor |
| Seeed | Berlin | Wikipedia 'Seeed': Berlin dancehall/reggae band formed in Berlin | Seeed |
| Rammstein | Berlin | Wikipedia 'Rammstein': formed in Berlin in 1994 | Rammstein |
| Wizkid | Lagos | Wikipedia 'Wizkid': born in Surulere, Lagos | Wizkid |
| Tems | Lagos | Wikipedia 'Tems': born in Lagos | TEms |
| Odunsi (The Engine) | Lagos | Wikipedia 'Odunsi (The Engine)': Lagos-based Nigerian artist | Odunsi (The Engine) |
| Hindia | Jakarta | Wikipedia 'Hindia': project of Baskara Putra, Jakarta | Hindia |
| Reality Club | Jakarta | Wikipedia 'Reality Club': Jakarta indie pop band | Reality Club |
| Rich Brian | Jakarta | Wikipedia 'Rich Brian': born in Jakarta | Rich Brian |
| BTS | Seoul | Wikipedia 'BTS': South Korean group formed in Seoul | BTS |
| BLACKPINK | Seoul | Wikipedia 'Blackpink': South Korean group formed in Seoul | BLACKPINK |
| IU | Seoul | Wikipedia 'IU (singer)': born in Seoul | IU |

## Method

1. Resolve each act with `GET /search`. Rule, fixed in the set file: Search 'types=urn:entity:artist&take=5' for the act name; use the first result whose name equals the act name ignoring case, accents and punctuation; otherwise the act is reported unresolved. Unresolved acts are listed with the reason and are not replaced.
2. For each resolved act and each city of the set: `GET /v2/insights` with `filter.type=urn:heatmap`, `filter.location.query=<city>`, `signal.interests.entities=<entity id>`; the adapter asserts the response shape and reduces the grid to cell count and mean `affinity_rank`; `cityStrengthFromAggregate` (core) rounds to three decimals and sets the thin flag.
3. Order cities by mean `affinity_rank` (ties: more cells, then name). Hit = the home city is first.

## Limits

- Small hand-picked sample (15 acts, 5 cities); no confidence interval is claimed.
- The city is a free-text query to Qloo; a name shared by several places is resolved by Qloo, not by us.
- Mean `affinity_rank` is relative inside each city's own rescaled grid. A city with few cells has a mean over few cells; the thin flag exists for that reason.
- Qloo popularity may favour well-known acts and large cities; this run does not separate that effect from taste.
- Home city is where the act is documented to be from or formed; it says nothing about where its listeners live.

## Live recording run

Recorded 2026-10-27 (one workstation, one network path) through the adapter (`@headliner/qloo` 0.1.0) at a concurrency cap of 3, against `hackathon.api.qloo.com`. Every 200 response was stored in `fixtures/qloo/proof/`; replay needs no key.

- Live calls: 130 (status codes: 200 x 130); adapter retries: 0; HTTP 429 responses: 0.
- Wall time: 40 s.

| Endpoint | Calls | Median ms | p95 ms | Max ms |
|---|---|---|---|---|
| `/search` | 45 | 353 | 435 | 1640 |
| `/v2/insights` | 70 | 623 | 2072 | 3180 |
| `/v2/insights/compare` | 15 | 390 | 466 | 466 |

Quota notes and the earlier latency measurements are in `docs/evidence/qloo-latency.md` (the daily quota is not observable from responses).
