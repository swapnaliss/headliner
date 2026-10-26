# Qloo integration spike: latency, call counts, quota (M0-02)

Recorded 2026-10-26 against `https://hackathon.api.qloo.com` from one workstation (one network path, one afternoon).
Raw per-call data: `docs/evidence/qloo-calls.json` (37 recorded calls) and `docs/evidence/qloo-burst.json` (40 probe calls).
Fixtures: `fixtures/qloo/` (37 files, indexed in `index.json`). Small samples: percentiles with n under 20 are indicative only.

## Live calls made

| Purpose | Calls |
|---|---|
| Fixtures (search 16, insights 3, compare 5, heatmap 10, trending 2, invalid 1) | 37 |
| Quota burst probe (20 at concurrency 1, then 20 at concurrency 6) | 40 |
| **Total** | **77** |

The burst stayed within the 40-call limit. No call returned 429 or 5xx.

## Latency per endpoint (ms) and response size

| Endpoint | n | min | median | p95 | max | response size (median / max, bytes) |
|---|---|---|---|---|---|---|
| `/search` | 16 | 314 | 335 | 1634 | 1634 | 19,136 / 37,827 |
| `/v2/insights` (artists, take 10) | 3 | 3309 | 3420 | 4952 | 4952 | 94,495 / 103,119 |
| `/v2/insights` burst, concurrency 1 | 20 | 3255 | 3404 | 3714 | 4659 | about 50-100 KB |
| `/v2/insights` burst, concurrency 6 | 20 | 3444 | 3915 | 5292 | 5293 | about 50-100 KB |
| `/v2/insights/compare` | 5 | 355 | 388 | 1631 | 1631 | 146,960 / 372,102 |
| `/v2/insights` heatmap | 10 | 507 | 704 | 1989 | 1989 | 8,115 / 366,755 |
| `/v2/trending` | 2 | 1515 | 1543 | 1572 | 1572 | 79 / 103 |
| `/v2/insights` with an invalid parameter | 1 | 4702 | 4702 | 4702 | 4702 | 50,832 |

The first call of every recorder run was the slowest of its endpoint group (about 1.6 s on `/search`, compare, heatmap): that is the cold connection. Warm `/search` and compare are about 0.3-0.4 s. `/v2/insights` (artist) is the slow endpoint at about 3.4 s and is not part of the resolve-then-compare chain. Wall time for 20 insights calls: 69.5 s sequentially, 17.1 s at concurrency 6 (4.1x faster; median per-call latency rose from 3.4 s to 3.9 s, so 6 in flight is tolerated).

## Findings that change the plan

- **Search `popularity` is present** on every result, a float in 0..1 (examples: Apparat 0.9967, Khruangbin 0.9919, Hindia 0.8705, Odunsi (The Engine) 0.7772, Radiohead 0.99999). It is a Qloo popularity percentile-style value, usable as the audience-standing input (ADR 0013), labelled "Qloo popularity rank". Entity ids are upper-case UUIDs in `entity_id`. A search takes `types=urn:entity:artist` and returns `{results:[...]}`.
- **Ambiguous query**: `Phoenix` returns 5 artists (Phoenix 0.9995, Phoenix Bodies 0.8715, ...), so a confirmation step is needed. **Non-ASCII** (`Sigur Rós`, `Björk`) resolves correctly. **No match** returns `{"results":[]}` with status 200 (no error). One resolve (`Amaarae`) returns the name lower-cased, so display names come from the search result, not the input.
- **List compare WORKS.** `a.signal.interests.entities` accepts a comma-separated list. With the 6 crowd ids, the response's `results.a` held 84 tags (a single crowd entity gave 30), the Electronic tag had `query.count` of 6, and all six crowd names appear in the per-tag `query["a.signal.interests.entities"]`. The `b` side also accepts a list (two candidates in one call returned 316 tags). Because a list on `b` merges candidates, a slate needs one compare per candidate with the whole crowd on `a`, not one call for all.
- **Compare response shape**: `body.results = { a: Tag[], b: Tag[], matchEntities: [], tags: Tag[] }`; every item of `results.tags[]` carries `query.score` (0..1; list-compare `khruangbin` range 0.540-0.881, mean 0.585, 116 tags) and the matched entity lists under `query["a..."]` / `query["b..."]`. Tags can repeat (for example `Electronic` appears more than once because Qloo returns the artist and the person entity of the same id; `b` echoed Khruangbin as both `urn:entity:artist` and `urn:entity:person`). Fit must de-duplicate by `tag_id`. `matchEntities` was empty in every compare call.
- **Heatmap**: `body.results.heatmap[] = { location:{latitude,longitude,geohash}, query:{affinity, affinity_rank, popularity, entity_artist_affinity_rank, entity_artist_affinity} }`.
- **Trending is a non-signal**: with a signal entity, `/v2/trending` returns `{"success":true,"results":{"trending":[]}}` (empty) for a 3-month window; without a signal it returns 400 `signal.interests.entities is required`. No momentum claims are possible; audience standing is the search `popularity` rank.
- **Invalid parameters are silently ignored.** `bogus.parameter=definitely-not-real` returned status 200 and the same first five artists as the clean call (Telefon Tel Aviv, Modeselektor, Murcof, Four Tet, Isan): this is why every adapter call asserts response shape. Rejected required parameters do return 400 with an `errors[]` array (as the trending case shows).

## Heatmap cell counts (Apparat unless noted)

| City | Cells | Note |
|---|---|---|
| London | 406 | |
| Berlin | 295 | |
| Leipzig | 39 | |
| Reykjavik | 23 | |
| Jakarta | 13 | thin (under 15) |
| Mumbai | 10 | thin |
| Lagos | 1 | thin |
| Tromso | 1 | thin |
| Jakarta (Reality Club) | 686 | |
| Lagos (Odunsi (The Engine)) | 1,337 | |

Thin cities exist (4 of 8 Apparat cities under 15 cells), so the thin-data caveat will fire in practice. Cell count depends on the act as well as the city (Lagos: 1 cell for Apparat, 1,337 for Odunsi).

## Qloo calls for a worked slate (6 crowd acts, 12 candidates)

| Plan | Resolves (search) | Compares | Total |
|---|---|---|---|
| List compare (all 6 crowd ids on `a`, one compare per candidate) | 6 + 12 = 18 | 12 | **30** |
| Per-act compare (one crowd entity on `a` per call) | 18 | 6 x 12 = 72 | **90** |

City detail adds up to 5 heatmap calls per act opened, as in ADR 0006.

## R1 and R3 verdict

- **R3 (30 calls per slate): holds** with the list-compare plan (30 calls). The per-act plan would be 90, 3x over, so list compare is the plan of record.
- **R1 (p95 12 s cold, 2 s warm): holds, estimated.** No full 12-candidate slate was run end to end. Estimate at concurrency 6 from the measurements above: 18 resolves = 3 waves of about 0.35 s (first wave 1.6 s cold), 12 compares = 2 waves of about 0.4 s (1.6 s cold p95), so about 2-5 s cold, under 12 s. Warm cache removes the Qloo calls. M1-01 should measure the real end-to-end slate and keep a per-call timeout of at most 10 s (observed max 5.3 s on the slowest endpoint). If a slate ever includes `/v2/insights` per act it adds about 3.4 s per call and 12 of them at concurrency 6 is about 8 s extra, which would threaten R1; keep insights off the slate path or lazy.
- Compare payloads are large (median 147 KB, max 372 KB); the cache (ADR 0002) should store the reduced shared-tag set, not the raw body.

## Quota and 429 behaviour

- 40 calls on `/v2/insights` (distinct URLs): 20 sequential, then 20 at concurrency 6. All 200. No 429, no 5xx, stop condition never triggered.
- Response headers recorded (non-secret allowlist: retry-after, rate-limit family, content-type, date, etc.): only `content-type: application/json; charset=utf-8` and `date` appeared. **No `Retry-After` and no rate-limit headers are sent**, so the remaining quota cannot be read from responses. The daily quota is still unknown; 77 calls caused no throttling. M1-01 must keep its own per-IP and global budget counters (ADR 0008) and treat any 429 as a hard stop with backoff, since the limit is invisible.
- Concurrency 6 is safe in this probe; higher was not tried.

## Reproduce

`node --env-file=<file with QLOO_API_KEY> scripts/qloo-record.ts <stage>`; stages are listed in the script header. The script reads the key only from the environment and never writes request headers.
