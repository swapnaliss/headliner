---
title: "M3-06 · UI states, accessibility and mobile pass"
milestone: "M3 · Agent Layer & Proof"
labels: ["frontend"]
blocked_by: ["M2-GATE"]
estimate: "4h"
resources: []
needs: []
---

## Context

Rubric: Design. Judges open the demo on a phone as often as a laptop, and an unhandled empty or error state reads as unfinished. This ticket makes every screen complete: loading, empty and error states, keyboard use, contrast, WCAG 2.2 AA, mobile layout. Builds to the screen specs in `docs/design/` (`design-system.md`, `room-setup.md`, `match-confirmation.md`, `slate.md`, `act-detail.md`) produced by M1-04. The banner "aggregate affinity, not a ticket forecast" must appear on every screen and standing is labelled "Qloo popularity rank". A ui-reviewer pass is required.

## Scope

- State matrix covering room setup, match confirmation, slate, act detail, shared slate, 404/expired slate, demo-limit reached, and the intake field: for each, a loading state (skeleton or progress with text, `aria-busy`), an empty state (for example an act with no data shows "No Qloo data for this act", thin city data shows the flag and caveat), and an error state (typed error code mapped to plain copy, retry action, partial results kept; never raw upstream text).
- Keyboard: logical tab order, visible focus ring (at least 3:1 contrast), no keyboard trap, Enter/Space on cards and match chips, Escape closes the evidence panel, skip-to-content link, focus moved to the heading or live region on route changes and results.
- Contrast and semantics: text 4.5:1, large text and UI components 3:1 in light and dark, color never the only signal (Fit bars carry numbers, thin flags carry text), landmarks, headings in order, labelled form fields with error association (`aria-describedby`), live region for slate-ready and errors, `prefers-reduced-motion` respected, target size at least 24x24 CSS px (WCAG 2.2 2.5.8), no dragging-only interactions, consistent help and focus not obscured by sticky elements (2.4.11).
- Mobile: layouts verified at 360, 390, 768 and 1280 px; no horizontal scroll; cards stack; the slate comparison reads in one column; inputs use appropriate `inputmode` and `autocomplete="off"` for act names; zoom to 200% without loss.
- Automated checks: `axe-core` via Playwright (or the repo's chosen runner) over every route and state in DEMO_MODE=fixtures, plus Playwright keyboard-walk tests and screenshots at the four widths stored in `docs/screenshots/`.
- Run the ui-reviewer agent over the changed screens and fix blocking findings; record the result in `docs/evidence/ui-review-m3.md`.

## Out of scope

- New features, new screens or changes to scoring.
- Visual redesign beyond the specs (spec changes go through the ux-designer, not this ticket).
- Full manual screen-reader audit on every device; one pass with a screen reader on the slate flow is recorded, nothing broader.

## Acceptance Criteria

- [ ] A state matrix test renders each screen in loading, empty and error states using fixtures and asserts the expected text and ARIA attributes.
- [ ] axe runs over all routes and states with zero serious or critical violations.
- [ ] The keyboard walk completes the core journey (setup, confirm, slate, open act, close evidence, share) with keyboard only, tested.
- [ ] No horizontal scroll at 360 px on any screen (assertion in the Playwright test).
- [ ] The banner text is present on every route (test iterates all routes).
- [ ] Contrast report for design tokens in light and dark shows all pairs at or above their threshold.
- [ ] `docs/evidence/ui-review-m3.md` records the ui-reviewer pass with no unresolved blocking finding.
- [ ] Screenshots at 360, 390, 768, 1280 px exist for slate and act detail.

## Deliverables

- `apps/web/app/**` state components (`Loading`, `Empty`, `ErrorState`) and fixes
- `apps/web/tests/a11y/*.spec.ts`, `apps/web/tests/keyboard/*.spec.ts`
- `docs/evidence/ui-review-m3.md`, `docs/evidence/contrast.md`
- `docs/screenshots/*-{360,390,768,1280}.png`

## Validation Gate

```bash
export DEMO_MODE=fixtures
npm run lint && npm run typecheck
npm test -- apps/web
npx playwright install --with-deps chromium >/dev/null 2>&1
npx playwright test apps/web/tests/a11y apps/web/tests/keyboard --reporter=line
OUT="${TMPDIR:-/tmp}/m3-06.json"
npx playwright test apps/web/tests/a11y --reporter=json > "$OUT"
jq -e '[.. | objects | select(has("status")) | select(.status=="unexpected")] | length==0' "$OUT"
grep -rn 'aggregate affinity, not a ticket forecast' apps/web/app | wc -l
test -s docs/evidence/ui-review-m3.md
```

## Handoff

- M3-GATE requires the a11y suite green and the ui-reviewer record.
- M4-01 uses the screenshots in the README Demo section.
- M4-02 uses the 390 px screenshots for Devpost.
