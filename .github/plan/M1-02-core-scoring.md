---
title: "M1-02 · Core scoring package: Fit, standing, caveats, thin-data flag"
milestone: "M1 · Walking Skeleton"
labels: ["backend", "critical"]
blocked_by: ["M0-03", "M0-GATE"]
estimate: "4h"
resources: []
needs: []
---

## Context

Rubric: Technological Implementation and Quality of the Idea. The hero number (Fit) must be deterministic, computed by code from recorded Qloo fields, and carry its evidence (ADR 0013, ADR 0001). The `core` module imports no framework and does no I/O, so it is testable offline against recorded fixtures and can never be influenced by an LLM (ADR 0009).

## Scope

A `core` workspace package (`packages/core`) implementing the definitions written by M0-03 in ADR 0013 exactly as completed there.

1. **`computeFit(compareResult)`** returns `{fit, overlapTags[], evidenceRefs[]}` from the recorded compare shape (`results.tags[]` with scores). Edge cases from M0-03 each have a branch: empty tag list, single tag, ties, missing or non-finite scores, score ranges outside the documented bounds.
2. **`computeStanding(candidate, crowdActs)`** returns the candidate's Qloo popularity position against the median of the crowd acts' popularity, labelled `"Qloo popularity rank"`; handles missing popularity (returns `unavailable` with a caveat, never a guess) and a crowd of one.
3. **`computeCityStrength(heatmapCells)`** returns `{meanAffinityRank, cellCount, thin}` with `thin = cellCount < 15`; pure function only (fetching is M2-03). Included here so the formula lives in one tested place.
4. **`buildCaveats(...)`** returns typed caveats: `thin-data`, `no-data`, `low-match-confidence`, `standing-unavailable`, `single-tag-overlap`, with fixed wording rules ("audience-taste fit", never forecast or turnout language).
5. **`rankActs(results)`** orders by Fit with a deterministic tie-break (standing then name), keeping `no-data` acts last and labelled.
6. **Types.** `Room`, `Act`, `ActResult`, `Slate`, `Evidence`, `Caveat` as shared zod schemas in `packages/core/src/types.ts` (the shapes in docs/architecture.md §2), reused by M1-03 and the UI.
7. **Invariant enforcement.** `assertEveryNumberHasEvidence(actResult)` throws if a numeric field lacks at least one Evidence reference.

## Out of scope

Any Qloo call (M1-01), the HTTP route (M1-03), nearby-city fetching (M2-03), LLM phrasing (M3-02). No I/O, no `fetch`, no `process.env`, no Date.now inside the package.

## Acceptance Criteria

- [ ] `npm test -w packages/core` passes offline; tests load fixtures from `fixtures/qloo/` and assert Fit, standing and city strength values for at least three recorded acts against the values stated in ADR 0013 / M0-03.
- [ ] One test per M0-03 edge case, named after the edge case.
- [ ] A property-style test shows `computeFit` is deterministic and order-independent for permuted tag lists.
- [ ] A test shows `rankActs` is stable and puts `no-data` acts last.
- [ ] A test shows `computeCityStrength` sets `thin` true for 14 cells and false for 15.
- [ ] An import-boundary check (ESLint `no-restricted-imports` or a test scanning imports) proves `packages/core` imports only `zod` and itself, and has no reference to `fetch`, `process`, `fs`, `next` or `@anthropic-ai`.
- [ ] A grep test proves no string in `packages/core/src` contains "forecast", "turnout" or "will sell".
- [ ] Package coverage for `packages/core` is reported and every exported function has at least one test.

## Deliverables

- `packages/core/src/fit.ts`, `standing.ts`, `city.ts`, `caveats.ts`, `rank.ts`, `types.ts`, `invariants.ts`, `index.ts`
- `packages/core/test/*.test.ts`
- ESLint boundary rule in the root lint config

## Validation Gate

```bash
set -euo pipefail
export TMPDIR="${TMPDIR:-/tmp}"
unset QLOO_API_KEY ANTHROPIC_API_KEY DATABASE_URL
npm ci
npm run typecheck -w packages/core
npm run lint
npm test -w packages/core -- --coverage --reporter=dot
! grep -rniE "forecast|turnout|will sell" packages/core/src
! grep -rnE "from ['\"](fs|node:fs|next|@anthropic-ai|pg|drizzle)" packages/core/src
```

## Handoff

M1-03 calls `computeFit`, `computeStanding`, `buildCaveats`, `rankActs` and imports the shared types. M2-01, M2-02 and M2-03 extend caveats and city strength using the same module. M3-02 phrases only fields of `Slate`; M3-04 reuses `computeFit` for the sanity test.
