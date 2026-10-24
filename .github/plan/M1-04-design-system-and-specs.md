---
title: "M1-04 · Design system and hero-screen specs"
milestone: "M1 · Walking Skeleton"
labels: ["frontend", "docs"]
blocked_by: ["M0-GATE"]
estimate: "2h"
resources: []
needs: []
---

## Context

Rubric: Design. Every `frontend` ticket builds to `docs/design/` and passes the `ui-reviewer` agent (CLAUDE.md, ADR 0005). `docs/design/` is currently empty, so this ticket produces the specs M1-05, M2-01, M2-02, M2-03, M2-04 and M3-06 build to. Run through the `ux-designer` agent. The product is a decision tool for independent venue talent buyers: calm, dense with evidence, never a consumer recommender.

## Scope

Documents in `docs/design/` (Markdown, with ASCII or SVG wireframes; no image of real data):

1. **`design-system.md`**: colour tokens (light and dark, each text/background pair with its measured contrast ratio, WCAG 2.2 AA: 4.5:1 body, 3:1 large text and UI components), type scale, spacing scale, radius, elevation, motion (respect `prefers-reduced-motion`), focus ring spec (visible, 3:1), touch targets at least 24px (target 44px on mobile), breakpoints (mobile-first at 360px).
2. **`components.md`**: Banner ("aggregate affinity, not a ticket forecast", present on every screen), Button, TextField with error text, ActChip, ActCard (rank, name, Fit, overlap tag chips, "Qloo popularity rank" standing, caveat chips, evidence link), Caveat chip (icon plus text, never colour alone), EvidenceRow (endpoint, redacted params, digest, fetched time; no headers), SkeletonCard, EmptyState ("no data" honest state), ErrorState, MatchPicker, CityStrip (thin-data flag), ThinDataBadge. For each: states (default, hover, focus, disabled, loading, error), props, accessible name and role.
3. **Screen specs** `screen-room-setup.md`, `screen-match-confirmation.md`, `screen-slate.md`, `screen-act-detail.md`: purpose, layout at 360px and 1280px, content hierarchy, every state (empty, loading, partial, error, no-data, thin-data), copy deck with exact strings (wording rule: "audience-taste fit", never forecast, turnout or will sell), keyboard order, landmarks and headings, live-region behaviour for async results, where Evidence appears, how untrusted entity names are rendered (plain text only).
4. **`accessibility.md`**: checklist later used by M3-06 (focus management on route change, skip link, form labels, error association, reduced motion, zoom to 200% without loss, no horizontal scroll at 320px).
5. **`index.md`** listing every file and the tickets that build to it.

## Out of scope

Implementation code (M1-05), final accessibility audit (M3-06), shared-page rendering details beyond a note (M2-04).

## Acceptance Criteria

- [ ] All six spec documents plus `design-system.md`, `components.md`, `accessibility.md`, `index.md` exist in `docs/design/` and are linked from `index.md`.
- [ ] Every colour pairing in the tokens table lists a contrast ratio computed by a script, and all meet WCAG 2.2 AA.
- [ ] Each screen spec contains the sections: Purpose, Layout (mobile and desktop), States, Copy, Keyboard and a11y, Data source (which `Slate` fields).
- [ ] The Banner string appears in every screen spec exactly as "aggregate affinity, not a ticket forecast".
- [ ] No spec contains the words forecast (other than in the Banner string), turnout or will sell.
- [ ] The `ux-designer` agent output was reviewed by the `ui-reviewer` agent and its findings are resolved.

## Deliverables

- `docs/design/index.md`, `design-system.md`, `components.md`, `accessibility.md`
- `docs/design/screen-room-setup.md`, `screen-match-confirmation.md`, `screen-slate.md`, `screen-act-detail.md`
- `scripts/check-contrast.mjs` (computes ratios for the token table; reused by M3-06)

## Validation Gate

```bash
set -euo pipefail
export TMPDIR="${TMPDIR:-/tmp}"
cd docs/design
for f in index design-system components accessibility screen-room-setup screen-match-confirmation screen-slate screen-act-detail; do test -s "$f.md"; done
for f in screen-*.md; do
  grep -q "aggregate affinity, not a ticket forecast" "$f"
  for h in "## Purpose" "## Layout" "## States" "## Copy" "## Keyboard and a11y" "## Data source"; do grep -q "^$h" "$f"; done
done
! grep -niE "turnout|will sell" *.md
! grep -niE "forecast" *.md | grep -v "not a ticket forecast"
cd ../..
node scripts/check-contrast.mjs docs/design/design-system.md | tee "$TMPDIR/m1-04-contrast.txt"
! grep -q FAIL "$TMPDIR/m1-04-contrast.txt"
```

## Handoff

M1-05 builds the room setup form, slate page, loading, error states and Banner to these specs. M2-01 builds `screen-match-confirmation.md`, M2-02 and M2-03 build `screen-act-detail.md`, M2-04 uses the plain-text rendering rule, M3-06 audits against `accessibility.md`.
