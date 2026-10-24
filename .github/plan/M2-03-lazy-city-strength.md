---
title: "M2-03 · Lazy city strength: heatmap aggregates on opening an act, thin-data flag, nearby-city strip"
milestone: "M2 · Core Loop"
labels: ["backend", "frontend", "chain"]
blocked_by: ["M1-GATE"]
estimate: "4h"
resources: ["QLOO"]
needs: []
---

## Context

City strength is the third pillar and the multi-endpoint chain (search/resolve -> insights/compare -> heatmap) that shows depth for Technological Implementation and the "where should this act play" angle for Potential Impact. ADR 0004 makes it lazy: heatmaps run only when an act is opened, up to 5 calls per act (R3). Heatmap `affinity` and `popularity` are rescaled per city, so cities are compared by mean `affinity_rank` and cell count only; under 15 cells is thin data (ADR 0013).

## Scope

- `packages/qloo`: `fetchHeatmap({ entityId, city })` using `/v2/insights` with `filter.type=urn:heatmap`, `filter.location.query=<city>`, `signal.interests.entities=<id>`; params built by URLSearchParams from a typed object; response-shape assertion on `results.heatmap[]` (cells with `location` and `query.{affinity, affinity_rank, popularity}`); cache read-through via the adapter.
- `packages/core/src/cityStrength.ts`, pure: `cityStrength(cells): { meanAffinityRank, cellCount, thin: boolean }` with `thin = cellCount < 15`; empty input returns `cellCount: 0, thin: true, meanAffinityRank: null`. Never compares raw `affinity` or `popularity` across cities.
- Aggregates only: the cache and slate store `{city, meanAffinityRank, cellCount, thin, evidence}`; raw grids are discarded before persistence (ADR 0002). A test asserts no `heatmap` array key reaches the store.
- `POST /api/slates/:id/acts/:actId/cities` with `{ cities: string[] }` (zod: max 5 cities, name length 80, from ADR 0003) runs the heatmap calls under the concurrency cap and the per-IP budget hook (M2-05), returns per-city aggregates plus a `thin_city_data` caveat per thin city; one failing city returns a `no_data` entry, others still return (partial results, ADR 0007).
- Frontend, built to `docs/design/screen-act-detail.md` (city strength section): triggered on opening an act (loading state per city, no layout shift), a ranked "City strength" list by mean `affinity_rank` with cell counts, a visible "Thin data" flag with its caveat text, and a nearby-city strip (the room city plus the other chosen cities). Banner present. Wording: "audience-taste fit in this city", never demand or turnout. Plain-text rendering, WCAG AA, mobile-first.
- Fixtures mode: recorded heatmaps in `fixtures/qloo/` (including one thin city and one empty city) serve the strip with zero keys.

## Out of scope

- Momentum or trend claims (trending is flat; documented non-signal).
- Cross-city comparison on rescaled `affinity` or `popularity`.
- The home-city evaluation (M3-04).
- Budget enforcement logic (M2-05); this ticket only calls its hook.

## Acceptance Criteria

- [ ] `cityStrength` tests cover 0 cells, 14 cells (thin), 15 cells (not thin), identical ranks, and missing `affinity_rank` fields; all pass.
- [ ] Adapter test: a heatmap response missing `results.heatmap` fails the shape assertion and yields `no_data`, not a crash.
- [ ] Opening an act triggers no heatmap call until the cities endpoint is requested (call counter is 0 after slate creation, asserted in a test).
- [ ] No more than 5 heatmap calls per request; a 6th city is rejected by schema; concurrency cap respected (test with a counting stub).
- [ ] The persisted record contains only aggregates (test asserts no per-cell data).
- [ ] The UI shows a "Thin data" flag for the thin fixture city and the no-data state for the empty fixture city.
- [ ] One live proof run, recorded under `docs/evidence/m2-03-live-heatmap.md` (request summaries only, no key): one real heatmap for one entity and city, latency noted.
- [ ] The ui-reviewer agent pass is recorded with no blocking findings.

## Deliverables

- `packages/qloo/src/heatmap.ts` and tests
- `packages/core/src/cityStrength.ts` and tests
- `apps/web/app/api/slates/[id]/acts/[actId]/cities/route.ts`
- City strength components under `apps/web/app/(app)/slate/[id]/act/[actId]/`
- `docs/evidence/m2-03-live-heatmap.md`

## Validation Gate

```bash
export DEMO_MODE=fixtures
npm ci && npm run lint && npm run typecheck
npx vitest run packages/core/src/cityStrength.test.ts packages/qloo apps/web
npm run build
grep -rn "affinity\b" packages/core/src/cityStrength.ts | grep -v affinity_rank | wc -l   # expect 0 raw-affinity comparisons
test -s docs/evidence/m2-03-live-heatmap.md && ! grep -qi 'x-api-key' docs/evidence/m2-03-live-heatmap.md
./scripts/check-no-secrets.sh
```

## Handoff

- M2-05 supplies the budget check that this route calls.
- M2-06 pre-warms the heatmap aggregates for the sample rooms.
- M3-04 reuses `cityStrength` for the home-city check.
- M2-GATE verifies the nearby-city strip and a thin-data flag on production.
