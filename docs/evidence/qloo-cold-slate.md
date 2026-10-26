# Cold slate time over the Qloo adapter (M1-01)

Measured 2026-10-26 with `scripts/cold-slate.mts` (run: `node --env-file=<env file> node_modules/tsx/dist/cli.mjs scripts/cold-slate.mts`) against `https://hackathon.api.qloo.com` from one workstation. Sample: **2 runs**, so these are indicative, not percentiles.

What is timed: the Qloo side of a 6-act crowd by 12-candidate slate, through `createQlooClient` with an empty in-memory cache, the shipped defaults (10 s timeout, one retry with jitter, 6 in flight): 18 searches in parallel, then 12 list compares (whole crowd on side A, one candidate on side B) in parallel. 30 successful calls per run. **Not included:** scoring (pure code), the HTTP route (M1-03), any LLM step, heatmaps (M2-03).

| Run | Searches (18) | Compares (12) | Total | Live calls made | 200 | 429 (retried) |
|---|---|---|---|---|---|---|
| 1 | 3,823 ms | 1,732 ms | 5,555 ms | 39 | 30 | 9 |
| 2 | 3,428 ms | 1,560 ms | 4,988 ms | 39 | 30 | 9 |

Findings:

- Cold Qloo-side slate time is about 5.0-5.6 s, inside the R1 estimate (under 12 s p95 end to end). The end-to-end figure (route, scoring, response) is for M1-03 to measure; it adds only the route and pure scoring on top of these numbers.
- **Qloo returned 429 on 9 of 39 calls in each run** (the first burst of 6 concurrent searches). Every one succeeded on the single retry, so no call failed, but each 429 spends a call: a cold 6x12 slate costs about 39 live calls, not 30. The M0-02 burst probe (insights at concurrency 6) saw no 429, so the limit is endpoint or burst specific. Logged to BL-01.
- Compare responses carried 116-274 tags each (12 candidates).

Live calls used by this ticket: 4 (smoke) + 39 + 39 (these two runs) = 82, of which 18 were 429s.
