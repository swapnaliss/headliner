---
title: "M1-05 · UI skeleton deployed: room setup and slate page"
milestone: "M1 · Walking Skeleton"
labels: ["frontend", "critical"]
blocked_by: ["M1-03", "M1-04", "M0-GATE"]
estimate: "4h"
resources: ["DEPLOY"]
needs: [P-02, P-03, P-04, P-11, P-12]
---

## Context

Rubric: Design and Technological Implementation. A judge must complete a first run on a hosted URL with no login (disqualifier otherwise: broken or local-only demo). This ticket delivers the first thin slice through all layers, deployed to production, built to the specs from M1-04 (ADR 0005: App Router, server components where possible, WCAG AA, mobile-first).

Builds to: `docs/design/screen-room-setup.md`, `docs/design/screen-slate.md`, `docs/design/design-system.md`, `docs/design/components.md`. Requires the `ui-reviewer` agent pass.

## Scope

1. **Design tokens and components** in `apps/web/src/ui/`: tokens as CSS variables (light and dark), Banner, Button, TextField, ActChip, ActCard, CaveatChip, SkeletonCard, EmptyState, ErrorState, exactly as `components.md`.
2. **Room setup page** `apps/web/app/page.tsx`: city field, 3 to 6 crowd acts, 1 to 12 candidate acts (add and remove rows, client-side limits mirroring the shared zod schema), labelled fields, inline error text associated via `aria-describedby`, a submit that posts to `POST /api/slates`, focus moved to the first error.
3. **Slate page** `apps/web/app/slates/[id]/page.tsx` (and the in-memory fixtures-mode equivalent): ranked ActCards with rank, name, Fit, overlap tag chips, standing labelled "Qloo popularity rank", caveat chips, link target for the evidence trail (detail view is M2-02), `no-data` acts shown with the honest empty state at the end.
4. **States.** Loading (SkeletonCards plus a polite live region), error (generic message with retry, never raw upstream text), `awaiting_confirmation` shown as a simple "matches need confirmation" notice (full flow M2-01).
5. **Banner** "aggregate affinity, not a ticket forecast" rendered in the root layout so it is on every screen.
6. **Plain-text rendering.** Entity names are rendered as text nodes only; no `dangerouslySetInnerHTML` anywhere.
7. **Production deploy.** Deploy to the host chosen in M0-01 from Git with environment wiring (`DATABASE_URL`, `QLOO_API_KEY` set in the host console by the owner per M0-00; never in the repo). Production runs live mode with the cache; a `DEMO_MODE=fixtures` preview or local run also works. Record the production URL in `docs/evidence/deploy.md`.
8. **Responsive and a11y basics** per `accessibility.md`: skip link, headings, landmarks, focus ring, 360px layout without horizontal scroll, `prefers-reduced-motion`.

## Out of scope

Match confirmation UI (M2-01), act detail and evidence panel (M2-02), city strength (M2-03), share-page hardening (M2-04), agent sentence intake (M3-01), the full states and a11y pass (M3-06).

## Acceptance Criteria

- [ ] With `DEMO_MODE=fixtures` and no keys, `npm run dev` or `npm start` serves the room setup page, submitting the recorded demo room shows ranked cards with Fit, tags, standing and caveats.
- [ ] The production URL serves the same flow without login or CAPTCHA, and `GET <url>/api/health` returns 200.
- [ ] The Banner string is present in the HTML of `/` and of a slate page.
- [ ] A component test renders an entity name of `<img src=x onerror=alert(1)>` and the DOM contains it as text with no `img` element.
- [ ] Component tests cover loading, error, empty and `no-data` states.
- [ ] A Playwright (or equivalent) smoke test at 360px width submits the form by keyboard only and finds no horizontal overflow.
- [ ] An automated axe check on `/` and the slate page reports zero serious or critical violations.
- [ ] The `ui-reviewer` agent pass has run against the four spec files and findings are resolved or recorded in the PR.
- [ ] No built client bundle contains the Qloo key (grep of `.next/static` for the key env var name's value is not possible, so the test greps for `X-Api-Key` and `hackathon.api.qloo.com`, which must be absent from client chunks).

## Deliverables

- `apps/web/app/layout.tsx`, `app/page.tsx`, `app/slates/[id]/page.tsx`, `app/globals.css`
- `apps/web/src/ui/*` components and tokens
- `apps/web/test/ui/*.test.tsx`, `apps/web/e2e/smoke.spec.ts`
- `docs/evidence/deploy.md` (production URL, deploy date, commit)

## Validation Gate

```bash
set -euo pipefail
export TMPDIR="${TMPDIR:-/tmp}"
unset QLOO_API_KEY OPENAI_API_KEY DATABASE_URL
export DEMO_MODE=fixtures
npm ci
npm run typecheck && npm run lint
npm test -w apps/web -- --reporter=dot
npm run build -w apps/web
! grep -rlE "X-Api-Key|hackathon\.api\.qloo\.com" apps/web/.next/static
! grep -rn "dangerouslySetInnerHTML" apps/web/app apps/web/src
npx playwright install --with-deps chromium >/dev/null
npm run e2e -w apps/web
URL="$(grep -oE 'https://[^ )]+' docs/evidence/deploy.md | head -1)"
curl -sfL "$URL/api/health" >/dev/null
curl -sfL "$URL/" | grep -q "aggregate affinity, not a ticket forecast"
```

## Handoff

M1-GATE exercises the production URL and the fixtures run. M2-01, M2-02, M2-03 and M2-04 extend these pages and components; M2-06 adds sample rooms to the intake screen; M3-06 hardens states and accessibility.
