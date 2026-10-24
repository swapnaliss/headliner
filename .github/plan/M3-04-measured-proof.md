---
title: "M3-04 · Measured proof: home-city check and Fit sanity test"
milestone: "M3 · Agent Layer & Proof"
labels: ["eval", "backend"]
blocked_by: ["M2-GATE"]
estimate: "3h"
resources: ["QLOO"]
needs: []
---

## Context

Rubric: Potential Impact and Technological Implementation. The success metric in PROJECT.md section 2 is a measured home-city check (the share of acts whose known home city has the highest mean affinity_rank) plus a Fit sanity test (same-genre acts outrank an off-genre control for a known crowd). Reported as measured with the sample listed and no preset target; 3 of 3 in recon is an observation, not a goal. Because affinity and popularity are rescaled per city, cities are compared by mean affinity_rank and cell count, with fewer than 15 cells flagged thin (ADR 0013).

## Scope

- Evaluation set file `evals/proof/home-city-set.json`: at least 12 acts with a documented home city (source noted per act, for example the act's public page) across at least 4 cities and at least 2 continents, chosen before looking at results; a committed git log shows the set precedes the results file.
- Home-city check `evals/proof/home-city.ts`: for each act, resolve the entity, run the heatmap (`/v2/insights`, `filter.type=urn:heatmap`, `filter.location.query=<city>`, `signal.interests.entities=<id>`) for the home city and for the other cities in the set, compute mean affinity_rank and cell count with the core city-strength function, mark thin (<15 cells), and report whether the home city ranks first. Thin-data cities are reported, not dropped, and shown with the flag. Report hits, misses and thin cases as counts out of N, with every row listed.
- Fit sanity test `evals/proof/fit-sanity.test.ts`: for at least 3 known crowds (for example a jazz-leaning, an electronic-leaning, a hip-hop-leaning crowd of 4 to 6 acts), at least 3 same-genre candidates and 1 off-genre control each; assert every same-genre candidate has higher Fit than the control. Misses are reported, not hidden; the test asserts the documented rule and writes the observed table.
- Two modes: `--live` (one-time recording run that hits Qloo within the measured quota and writes recorded responses to `fixtures/qloo/proof/`) and replay (default, from fixtures, used in CI and by anyone with no key). Calls are sequenced under the adapter's concurrency cap and cache.
- Output `docs/evidence/home-city-check.md` and `docs/evidence/fit-sanity.md`: sample list, method, date, adapter version, counts, every row, limits (small sample, per-city rescaling, popularity bias), and no claim beyond the data. No target threshold is written anywhere in code or text.

## Out of scope

- Tuning the Fit formula to improve results (a failing observation is reported honestly; formula changes are an ADR 0013 amendment decision for the owner).
- Ticket-sales or turnout claims.
- Momentum or trending analysis (/v2/trending is flat here).

## Acceptance Criteria

- [ ] The evaluation set has at least 12 acts, at least 4 distinct home cities, and a source note for each home city.
- [ ] Replay mode `npm run proof` runs offline from `fixtures/qloo/proof/` and reproduces the committed tables byte for byte.
- [ ] `docs/evidence/home-city-check.md` lists every act with home city, mean affinity_rank and cell count per city, thin flags, and the hit count as "k of N", with no pass/fail threshold.
- [ ] `docs/evidence/fit-sanity.md` lists each crowd, candidates, Fit values and whether each same-genre candidate outranked the control.
- [ ] A test fails if the set file is edited without regenerating the evidence (digest of the set is recorded in the report).
- [ ] Live run call count and latency are recorded in the report and stay within the quota notes in `docs/evidence/qloo-latency.md`.
- [ ] No key or header appears in fixtures or reports (`./scripts/check-no-secrets.sh`).

## Deliverables

- `evals/proof/{home-city-set.json,home-city.ts,fit-sanity.test.ts,run.ts}`
- `fixtures/qloo/proof/*.json`
- `docs/evidence/home-city-check.md`, `docs/evidence/fit-sanity.md`
- npm script `proof`

## Validation Gate

```bash
env -u QLOO_API_KEY DEMO_MODE=fixtures npm run proof
OUT="${TMPDIR:-/tmp}/m3-04.json"
env -u QLOO_API_KEY DEMO_MODE=fixtures npm run proof -- --json > "$OUT"
jq -e '(.homeCity.acts|length)>=12 and ([.homeCity.acts[].homeCity]|unique|length)>=4' "$OUT"
npm test -- evals/proof
git diff --exit-code docs/evidence/home-city-check.md docs/evidence/fit-sanity.md
grep -ciE 'target|threshold' docs/evidence/home-city-check.md | grep -qx 0
./scripts/check-no-secrets.sh
```

## Handoff

- M4-01 quotes the results as "k of N, sample listed" with the honest limits.
- M4-02 uses the same numbers in the Devpost text; they must match the evidence files.
- M3-GATE re-runs `npm run proof` in replay mode.
