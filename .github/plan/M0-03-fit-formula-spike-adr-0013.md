---
title: "M0-03 · Fit formula spike and ADR 0013 completion"
milestone: "M0 · Recon & Bootstrap"
labels: ["recon", "backend", "critical"]
blocked_by: ["M0-02"]
estimate: "3h"
resources: []
needs: []
---

## Context

The hero number of the product is Fit, and Technological Implementation and Quality of the Idea both rest on it being a documented, deterministic, checkable function of Qloo fields, never an LLM guess (ADR 0009, `CLAUDE.md` domain rules). ADR 0013 is currently Proposed; M1-02 cannot build the core scoring package until it is Accepted with a precise definition. This ticket runs on recorded data only (no live calls).

## Scope

Using the fixtures from M0-02, define and prototype as pure TypeScript functions in `packages/core/src/scoring/` (the production versions M1-02 will harden):

1. **Fit**: a deterministic function from the compare result (`results.tags[]` with scores) between the crowd set and one candidate to a number in a fixed documented range (propose 0 to 100), with the exact aggregation (candidate in ADR: mean of shared-tag scores), the rounding rule, the minimum number of shared tags required, and how crowd acts are combined (per the list-compare finding in `docs/evidence/qloo-latency.md`: one list compare, or a documented aggregation across per-act compares).
2. **Audience standing**: the candidate's Qloo popularity position against the median of the crowd acts' popularity, from the search `popularity` field, as a labelled "Qloo popularity rank" (never a capacity or draw claim); define the output (rank comparison and a plain label such as above, similar, below) and thresholds.
3. **City strength**: mean `affinity_rank` across heatmap cells and cell count, with the thin-data flag when fewer than 15 cells; note that affinity and popularity are rescaled per city, so only the mean rank and cell count are compared across cities.
4. **Edge cases**, each with a named test: empty tags; one shared tag only; missing `popularity` on candidate or crowd; all crowd acts missing popularity; duplicate candidate; candidate equal to a crowd act; zero cells; exactly 14 and 15 cells; cells with missing `affinity_rank`; ties in ranking (stable, tie-break by name then entity id); non-finite or out-of-range scores; unresolved entity (no data, never a zero).
5. **Sanity check on recorded data**: a script `scripts/fit-sanity.ts` computes Fit for the recorded candidates against the recorded crowd and prints a table with the sample listed; at least one same-genre act should outrank an off-genre control in the recording. If the recorded data does not show this, report the measured result honestly in the ADR and propose the formula refinement that is evidenced by the data; do not tune to hit a preset number.
6. **Complete ADR 0013**: rewrite `docs/adr/0013-fit-formula.md` with the final definition, inputs by field path, edge-case table, the sanity table with sample, rejected alternatives, and change `Status:` to `Accepted` with the date and the line "owner approval at the M0 gate". It states which user-facing words are allowed ("audience-taste fit") and that Fit is not a forecast.

## Out of scope

- The production scoring package, caveat strings and Evidence assembly (M1-02).
- Any live Qloo or LLM call.
- Any UI.

## Acceptance Criteria

- [ ] `docs/adr/0013-fit-formula.md` has `Status: Accepted`, the formula, the field paths it reads, the output range and rounding, the standing definition and label, the city-strength definition with the 15-cell threshold, and the edge-case table
- [ ] Each edge case in Scope item 4 has at least one passing test in `packages/core/test/scoring.test.ts`
- [ ] The functions are pure: `packages/core` imports no framework or I/O (lint boundary from M0-01 passes)
- [ ] The same inputs always give the same outputs (a determinism test runs each function twice and compares)
- [ ] `scripts/fit-sanity.ts` runs offline, lists its sample, and its output is pasted into the ADR
- [ ] Documentation uses "audience-taste fit" and never "forecast", "turnout" or "will sell" as a claim

## Deliverables

- `packages/core/src/scoring/fit.ts`, `standing.ts`, `cityStrength.ts`, `index.ts`
- `packages/core/test/scoring.test.ts`
- `scripts/fit-sanity.ts`
- `docs/adr/0013-fit-formula.md` (Accepted)

## Validation Gate

```bash
set -euo pipefail
grep -q '^Status: Accepted' docs/adr/0013-fit-formula.md
! grep -qi 'PROPOSED' docs/adr/0013-fit-formula.md
env -i PATH="$PATH" HOME="$HOME" npm test --silent -- packages/core
npm run lint --silent
npm run typecheck --silent
T="$(mktemp -d "${TMPDIR:-/tmp}/m0-03.XXXXXX")"
env -i PATH="$PATH" HOME="$HOME" npx tsx scripts/fit-sanity.ts > "$T/sanity.txt"
test -s "$T/sanity.txt"
npx tsx scripts/fit-sanity.ts | diff - "$T/sanity.txt"   # deterministic
grep -Eq 'thin|14|15' docs/adr/0013-fit-formula.md
! grep -Eiq 'will sell|turnout forecast' docs/adr/0013-fit-formula.md
./scripts/check-no-secrets.sh
```

## Handoff

- M1-02 implements the core scoring package from ADR 0013 and the prototype tests (Fit, standing, caveats, thin-data flag).
- M1-03 wires scoring into the pipeline; M2-03 reuses city strength; M3-04 reuses the Fit sanity approach.
- M0-GATE checks ADR 0013 is Accepted.
