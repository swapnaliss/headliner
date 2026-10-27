# ADR 0013: Fit formula

Status: Accepted (2026-10-26, M0-03; owner approval at the M0 gate)

## Context
The hero number needs a documented, deterministic, checkable definition. Fit is computed by code from fields in recorded Qloo responses; the LLM never computes or invents it, it only phrases fields from the Slate (ADR 0009). The functions are pure TypeScript in `packages/core/src/` (no framework, no I/O), hardened in M1-02. The tests are `packages/core/test/*.test.ts`; the recorded-data check is `scripts/fit-sanity.ts`.

## Words allowed in the product
"Audience-taste fit" (short form "Fit") and "Qloo popularity rank". Fit is aggregate affinity between a candidate's audience tastes and the venue's regular crowd. It is not a ticket forecast and says nothing about sales, attendance or capacity; the banner "aggregate affinity, not a ticket forecast" appears on every screen. Words that imply prediction are never used as a claim.

## Decision

### 1. Fit (0 to 100, one decimal)
Input: one `GET /v2/insights/compare` response with the whole crowd on `a` (comma-separated entity ids) and one candidate on `b`, `filter.type=urn:entity:artist`. Per `docs/evidence/qloo-latency.md`, one list compare per candidate is the plan of record (30 calls for a 6 x 12 slate; per-act compares would be 90). A list on `b` merges candidates, so candidates are never batched.

Fields read, by path: `results.tags[].tag_id`, `results.tags[].query.score` (0..1), `results.tags[].query["a.signal.interests.entities"][].entity_id`.

Algorithm (`computeFit`):
1. Drop (and count in `droppedTags`) every entry whose `tag_id` is blank or whose `score` is not a finite number in 0..1.
2. Qloo repeats a tag once per subset of the crowd it matched, and once more for the artist and the person entity of one id (measured: the Khruangbin compare has 116 entries but 46 distinct `tag_id`s, and scores differ between repeats). Group by `tag_id`. For each group use the repeat whose `a` side covers the most distinct crowd entity ids (ties: the higher score). This is the repeat that speaks for the widest part of the crowd.
3. If fewer than 3 distinct tags remain, Fit is unavailable (`FIT_MIN_SHARED_TAGS = 3`).
4. Fit = 100 x the mean of the chosen scores, summed in `tag_id` order (so response order cannot change the float), rounded half away from zero to one decimal.

Crowd acts are combined by Qloo itself (list on `a`); the code does not average per-act compares.

### 2. Audience standing (labelled "Qloo popularity rank")
Inputs: search `results[].popularity` (0..1, present on every result in the recording) for the candidate and each crowd act. Percentile = popularity x 100, one decimal. Compare the candidate with the median of the usable crowd values (even count: mean of the two middle values). `deltaPoints` = candidate minus median, in percentile points, one decimal. Label: `above` if `deltaPoints > 5`, `below` if `< -5`, else `similar` (exactly 5 is similar). The output also carries the caption "Qloo popularity rank" and `crowdSample` (crowd acts with usable popularity). `/v2/trending` is flat in this environment, so standing is a rank comparison, never momentum, capacity or draw.

### 3. City strength
Input: heatmap cells `results.heatmap[].query.affinity_rank` (0..1). Cell count = cells with a usable `affinity_rank`; mean `affinity_rank` to three decimals; `thinData = cellCount < 15` (14 cells is thin, 15 is not). Heatmap `affinity` and `popularity` are rescaled per city, so only the mean `affinity_rank` and the cell count are compared across cities, never raw affinity or popularity. Cells with a missing or invalid rank are dropped and reported in `droppedCells`.

### 4. Ranking
Candidates are ordered by Fit descending, then name, then entity id (code-unit order, locale-independent). Ties get distinct, stable positions. Candidates with no Fit follow all scored ones in the same order. A repeated entity id (case-insensitive) is kept once.

Display constants (M1-05): `FIT_CLOSE_SPREAD_POINTS = 5` (when best minus worst Fit among scored acts is below 5 points the slate says neighbouring ranks are close; the recorded 2.5-point spread is only an example) and `STANDING_SIMILAR_BAND_POINTS = 5` (the band in section 2, already in code). Both live in `packages/core`.

### 5. Edge cases (each has a named test in `packages/core/test/`)
| Case | Behaviour |
|---|---|
| Empty or missing tags | `unavailable: no-shared-tags`, never 0 |
| One or two distinct shared tags | `unavailable: too-few-shared-tags` (minimum 3) |
| Non-finite or out-of-0..1 score, blank tag_id | entry dropped, counted in `droppedTags`; if too few remain, unavailable |
| Candidate popularity missing | standing `unavailable: candidate-popularity-missing` |
| Some crowd popularity missing | median over the rest; `crowdSample` shows how many |
| All crowd popularity missing | standing `unavailable: crowd-popularity-missing` |
| Duplicate candidate | kept once (first) |
| Candidate equals a crowd act | Fit `unavailable: candidate-in-crowd` (case-insensitive id) |
| Unresolved entity or no compare result | Fit `unavailable: unresolved-entity`, never a zero |
| Zero heatmap cells, or none with a usable rank | city strength `unavailable: zero-cells` |
| Exactly 14 cells / exactly 15 cells | thin / not thin |
| Cell missing `affinity_rank` | dropped, not counted |
| Ties in ranking | stable: name, then entity id |
| Determinism | every function is run twice (and with reversed input order) and compared |

## Sanity check on recorded data
Command: `npx tsx scripts/fit-sanity.ts`, offline, fixtures from M0-02 (recorded 2026-10-26). Sample: crowd of 6 acts (Apparat, Moderat, Modeselektor, Hundreds, Brandt Brauer Frick, Boys Noize), 3 candidates (Khruangbin, Radiohead, Reality Club), 8 Apparat heatmaps. The "alt" column shows other per-tag repeat rules (max, mean of repeats, raw mean with no de-duplication) as evidence only.

```
# fit-sanity (ADR 0013), recorded fixtures only
crowd (6 acts, one list compare per candidate): Apparat, Moderat, Modeselektor, Hundreds, Brandt Brauer Frick, Boys Noize
candidates (3): Khruangbin, Radiohead, Reality Club

## Fit and standing
rank  candidate      fit    tags   standing               alt: max / mean / raw
1     Reality Club   60.6   71     86.4 vs 99.5 below     61.9 / 60.8 / 59.7
2     Radiohead      59.5   86     100.0 vs 99.5 similar  60.9 / 59.7 / 58.8
3     Khruangbin     58.1   46     99.2 vs 99.5 similar   60.2 / 58.5 / 58.5
spread of Fit across the 3 candidates: 2.5 points

## Same-genre control check
Khruangbin     candidate-side tags include Electronic (crowd genre): no
Radiohead      candidate-side tags include Electronic (crowd genre): yes
Reality Club   candidate-side tags include Electronic (crowd genre): no
No candidate in the recording is an electronic act like the crowd (Radiohead only carries the
tag among 35), so same-genre-outranks-off-genre cannot be evaluated here. Not tuned to fit.

## City strength (Apparat heatmaps; compare mean affinity_rank and cell count only)
city       cells  mean rank  thin-data
london     406    0.599      no
berlin     295    0.847      no
leipzig    39     0.706      no
reykjavik  23     0.742      no
jakarta    13     0.276      yes
mumbai     10     0.533      yes
lagos      1      0.325      yes
tromso     1      0.877      yes
```

Measured result, reported honestly:
- The recording contains no same-genre candidate for this electronic Berlin crowd (M0-02 recorded Khruangbin, Radiohead and Reality Club as candidates). The ticket's check "a same-genre act outranks an off-genre control" therefore could not be run on the recorded data. Nothing was tuned to reach a preset ordering.
- Fit values on the three recorded candidates sit between 58.1 and 60.6 (spread 2.5 points) under every repeat rule tried, and the ordering (Reality Club, Radiohead, Khruangbin) is the same under max, mean and the chosen rule. Qloo's tag scores in these responses never fall below about 0.54, so the mean is compressed into a narrow band. Readers must not over-read differences of a point or two.
- Shared-tag count varies widely (46, 71, 86) while the mean barely moves, so breadth of overlap is not captured by the mean.
- Evidenced refinement to decide at the M0 gate or in M1-02, once a same-genre recording exists: record one compare of the same crowd against an electronic act (for example a Berlin electronic act not in the crowd) and one against a clearly off-genre act, then check whether the mean separates them; if it does not, consider a documented rescaling of the 0.54-1.0 observed range and a shared-tag-breadth term. This needs one more recording (a live call), outside this ticket's recorded-data scope. It is logged to the backlog.
- City strength: `mean affinity_rank` and `cellCount` separate the cities and the 15-cell rule flags Jakarta (13), Mumbai (10), Lagos (1) and Tromso (1) as thin-data. A single-cell city can have a high mean rank (Tromso 0.877), which is why the cell count and the caveat always travel with it.
- Standing: Reality Club (86.4) is below the crowd median (99.5); Khruangbin and Radiohead are within 5 points.

## Alternatives rejected
- LLM-scored fit: not checkable, not deterministic, violates ADR 0009.
- Averaging per-act compares: 3x the Qloo calls (90 against 30 per slate).
- Using every raw `results.tags` entry (no de-duplication): double-counts the artist/person repeats and weights tags by how many crowd subsets Qloo happened to emit.
- Taking the maximum score per tag: lets a single crowd act's strong match represent the whole crowd.
- Raw heatmap `affinity` or `popularity` across cities: rescaled per city, not comparable.
- Trending momentum for standing: `/v2/trending` is flat in this environment.

## Consequences / cost to reverse
Low until the UI is built on it. Changing the per-tag rule or the scale changes every Fit number, so a change after M1-02 needs the fixtures' expected values and the sample table above updated together.

## Update 2026-10-27 (M3-04): measured results on a same-genre recording
Decision text above is unchanged. The missing same-genre recording noted under "Sanity check on recorded data" now exists: `fixtures/qloo/proof/` (130 live calls, no 429), reports in `docs/evidence/fit-sanity.md` and `docs/evidence/home-city-check.md`, replay with `npm run proof`. Sets were pre-registered in a commit that precedes the results.
- Fit sanity: 11 of 12 same-genre candidates scored a higher Fit than their crowd's off-genre control (electronic crowd 4 of 4, hip-hop 4 of 4, jazz 3 of 4). The miss is Brad Mehldau against Metallica for the jazz crowd (58.1 against 58.3). Margins are small (jazz +0.1 to +0.8 among the candidates that outrank; the electronic crowd +1.3 to +4.0), consistent with the compressed score band described above. No formula change was made or proposed from this; whether to add a rescaling or a breadth term remains an owner decision.
- Home-city check: 11 of 14 resolved acts (15 listed, 1 unresolved) have their documented home city as the city with the highest mean `affinity_rank` among 5 cities; the three misses are the three Seoul acts, whose strongest city in the set is Jakarta.
