---
title: "M2-02 · Act detail and evidence trail: shared tastes, standing explanation, redacted requests"
milestone: "M2 · Core Loop"
labels: ["frontend", "backend"]
blocked_by: ["M1-GATE"]
estimate: "4h"
resources: []
needs: []
---

## Context

The rubric rewards checkable, not asserted, numbers (Technological Implementation, Potential Impact). Every number in an `ActResult` has at least one `Evidence` (architecture invariant) and the act detail is where a judge verifies it. Storyboard step: "open the top act: shared tastes and evidence". Audience standing is labelled "Qloo popularity rank" (ADR 0013); there are no momentum claims.

## Scope

- Backend:
  - Extend `ActResult` (core) with `overlapTags[]` (tag name, compare score, from `/v2/insights/compare` `results.tags[]`), `standingExplanation` (structured: candidate popularity position, crowd median, the two numbers' source evidence ids), and `caveats[]` (typed codes with fixed plain-text templates: `no_data`, `low_match_confidence`, `thin_city_data`, `standing_not_capacity`).
  - `GET /api/slates/:id/acts/:actId` returns the act detail from the stored Slate (no new Qloo call).
  - `redactEvidence(evidence): PublicEvidence` in `packages/qloo/src/evidence.ts`: endpoint path, typed params (filter.type, entity ids, city), status, fetchedAt, `responseDigest`. Headers are never in the type at all; a test proves `X-Api-Key` and any header map cannot be serialised. Raw upstream bodies and error strings never appear.
- Frontend, built to `docs/design/screen-act-detail.md`: header with act name and Fit; "Shared tastes" list with scores; "Audience standing" panel labelled "Qloo popularity rank" with the explanation; "Evidence" expandable panel listing each request as redacted text (copyable); caveats list; a clear empty state for an act with no data ("No Qloo data for this act", the honest empty state from the storyboard). Banner "aggregate affinity, not a ticket forecast" on the screen. Plain-text rendering of all third-party strings. Mobile-first, WCAG AA, keyboard-operable disclosure.

## Out of scope

- City strength strip and heatmap calls (M2-03).
- Share link UI (M2-04).
- LLM-phrased explanation (M3-02).

## Acceptance Criteria

- [ ] Act detail for a fixture act shows overlap tags whose scores equal the recorded compare fixture (test compares rendered values to fixture values).
- [ ] Every rendered number maps to at least one evidence entry (test iterates the ActResult and asserts a non-empty evidence reference).
- [ ] Serialised public evidence for a run contains no `X-Api-Key`, no header section, and no value matching the key canary set in the environment (test with `CANARY_KEY=canary-xyz-123`, grep output for it, expect 0).
- [ ] An act whose compare returns no tags renders the no-data empty state with the `no_data` caveat and no invented numbers.
- [ ] Standing is labelled "Qloo popularity rank" and the word "forecast" appears only in the banner negation (grep test of UI strings).
- [ ] A fixture-mode upstream failure surfaces a generic error, never the raw upstream body (test).
- [ ] The ui-reviewer agent pass is recorded with no blocking findings.

## Deliverables

- `packages/core/src/caveats.ts`, extended `ActResult` types and tests
- `packages/qloo/src/evidence.ts` and tests
- `apps/web/app/api/slates/[id]/acts/[actId]/route.ts`
- `apps/web/app/(app)/slate/[id]/act/[actId]/` page and evidence components

## Validation Gate

```bash
export DEMO_MODE=fixtures CANARY_KEY=canary-xyz-123
npm ci && npm run lint && npm run typecheck
npx vitest run packages/core packages/qloo apps/web
npm run build
OUT=$TMPDIR/m2-02; mkdir -p "$OUT"
npx vitest run packages/qloo/src/evidence.test.ts --reporter=verbose > "$OUT/ev.txt" 2>&1
grep -c canary-xyz-123 "$OUT/ev.txt"    # expect 0
grep -rniE 'forecast|turnout|will sell' apps/web/app apps/web/components | grep -v 'not a ticket forecast' | wc -l   # expect 0
./scripts/check-no-secrets.sh
```

## Handoff

- M2-03 adds the city strength strip to this page's layout slot.
- M2-04 renders the same detail in shared, plain-text form.
- M3-02 phrases the explanation over these structured fields only.
- M2-GATE verifies the evidence trail on production.
