# Fit sanity test (measured)

> Aggregate affinity, not a ticket forecast.

Set file: `evals/proof/fit-set.json`, sha256 `bc54fbdb10232cefa59cbd7b9bedc8c40cf8c64ac57c812015909b678a5d3009` (chosen 2026-10-27, before any compare for these acts was requested). A test fails if the set is edited without regenerating this file.

## Question

For a known crowd, does each same-genre candidate get a higher audience-taste fit (Fit, ADR 0013) than one clearly off-genre control? This is a sanity check of the formula on real Qloo responses, not a claim about any venue.

## Result

- Crowds: 3; same-genre candidates: 12; comparable with their control: 12.
- Same-genre candidates with a higher Fit than their crowd's control: **11 of 12**.

- electronic: 4 of 4 same-genre candidates outrank the control (Johnny Cash, Fit 58.1).
- jazz: 3 of 4 same-genre candidates outrank the control (Metallica, Fit 58.3).
- hip-hop: 4 of 4 same-genre candidates outrank the control (Dolly Parton, Fit 70.8).

No pass or fail line is applied. A miss is shown as a miss, and the Fit formula was not changed after seeing these numbers.

## Every crowd

### electronic: an electronic-leaning, Berlin-style crowd

Crowd (6 acts, one list compare per candidate with the whole crowd on side A): Apparat, Moderat, Modeselektor, Hundreds, Brandt Brauer Frick, Boys Noize.

| Candidate | Role | Fit | Fit minus control | Shared tags | Higher than control |
|---|---|---|---|---|---|
| Four Tet | same-genre | 59.9 | +1.8 | 115 | yes |
| Bonobo | same-genre | 62.1 | +4.0 | 67 | yes |
| Jon Hopkins | same-genre | 59.4 | +1.3 | 104 | yes |
| Caribou | same-genre | 59.7 | +1.6 | 123 | yes |
| Johnny Cash | control | 58.1 | n/a | 39 | n/a |

### jazz: a jazz-leaning crowd

Crowd (5 acts, one list compare per candidate with the whole crowd on side A): Miles Davis, John Coltrane, Herbie Hancock, Kamasi Washington, Esperanza Spalding.

| Candidate | Role | Fit | Fit minus control | Shared tags | Higher than control |
|---|---|---|---|---|---|
| Robert Glasper | same-genre | 59.1 | +0.8 | 115 | yes |
| Pat Metheny | same-genre | 58.4 | +0.1 | 110 | yes |
| Brad Mehldau | same-genre | 58.1 | -0.2 | 112 | no |
| Sonny Rollins | same-genre | 58.7 | +0.4 | 91 | yes |
| Metallica | control | 58.3 | n/a | 70 | n/a |

### hip-hop: a hip-hop-leaning crowd

Crowd (5 acts, one list compare per candidate with the whole crowd on side A): Kendrick Lamar, J. Cole, Nas, Tyler, the Creator, A Tribe Called Quest.

| Candidate | Role | Fit | Fit minus control | Shared tags | Higher than control |
|---|---|---|---|---|---|
| Jay-Z | same-genre | 71.2 | +0.4 | 15 | yes |
| Run the Jewels | same-genre | 71.5 | +0.7 | 69 | yes |
| Denzel Curry | same-genre | 72.1 | +1.3 | 66 | yes |
| Little Simz | same-genre | 71.5 | +0.7 | 74 | yes |
| Dolly Parton | control | 70.8 | n/a | 28 | n/a |

## Method

1. Resolve every name with `/search` as in the home-city check.
2. One `GET /v2/insights/compare` per candidate with the crowd's entity ids on `a.signal.interests.entities` and the candidate on `b.signal.interests.entities`, `filter.type=urn:entity:artist`.
3. Fit = core `computeFit` over `results.tags` (de-duplicated by tag, mean of chosen scores x 100, one decimal). Unavailable results are shown as unavailable, never as zero.
4. Higher than control = strictly greater Fit.

## Limits

- 3 crowds with 3 to 6 acts each and hand-picked candidates; genre labels are the author's, not Qloo's.
- Fit values sit in a narrow band (Qloo tag scores are compressed, ADR 0013), so differences of a point or two should not be over-read.
- The control is one act per crowd; a single off-genre act cannot represent every off-genre act.
- Candidate popularity may influence Qloo's tag scores; this run does not separate that effect.

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
