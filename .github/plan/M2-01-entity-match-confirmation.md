---
title: "M2-01 · Entity match confirmation: ambiguous matches block ranking until confirmed"
milestone: "M2 · Core Loop"
labels: ["frontend", "backend"]
blocked_by: ["M1-GATE"]
estimate: "3h"
resources: []
needs: []
---

## Context

Architecture invariant: "an ambiguous match blocks ranking until confirmed". A wrong entity match (a different artist with the same name) silently corrupts every number on the slate, so this is the honesty layer for Technological Implementation and Quality of the Idea. The demo storyboard step "confirm matches" is built here. Qloo `/search` returns `results[]` with `entity_id`, `name`, `popularity`, `tags`, `properties`; a name can return several plausible entities.

## Scope

- Backend (`packages/core` pure, `packages/qloo`, route handlers in `apps/web`):
  - `classifyMatch(query, results[]): MatchState` in `packages/core/src/matching.ts`, pure. States: `exact` (one result whose normalised name equals the query, normalisation = NFKC, case-fold, trim, collapse whitespace), `ambiguous` (more than one plausible result, or top result name differs from the query), `none` (empty results). Returns up to 5 candidates, each with `entity_id`, `name`, `popularity`, and up to 3 `tags` for disambiguation.
  - Run state machine per architecture section 2: `matching -> awaiting_confirmation -> scoring`. `POST /api/slates` (from M1-03) returns `status: "awaiting_confirmation"` with `matches[]` when any act is `ambiguous` or `none`, and does no compare/scoring calls for it. New `POST /api/slates/:runId/confirm` accepts `{ choices: [{ actInput, entityId | "skip" }] }` (zod, shared schema, limits from ADR 0003) and then continues to scoring. Confirmed entity ids must belong to the candidate list returned earlier for that run (server-side check, never trust the client id).
  - Duplicate handling: two inputs resolving to the same `entity_id` are merged into one act with a visible note; a crowd act whose `entity_id` equals a candidate is excluded from the candidate list with a note ("already in your crowd"), never scored against itself.
  - Location confirmation: the resolved city string (as the heatmap `filter.location.query` will receive it) is returned as `room.locationDisplay`; no geocoding beyond what Qloo returns.
- Frontend, built to `docs/design/screen-match-confirmation.md` (and tokens from `docs/design/`): a confirmation screen listing each input with its candidates as a radio group (name, 3 tags, Qloo popularity), a "skip this act" option, a location confirmation line, and a disabled "Rank" button until every ambiguous act is resolved. Names rendered as plain text only. Banner "aggregate affinity, not a ticket forecast" present. Keyboard and screen-reader operable; mobile-first.
- Fixtures mode (`DEMO_MODE=fixtures`) serves a recorded ambiguous search from `fixtures/qloo/` so the screen is reachable with zero keys.

## Out of scope

- Agent-proposed matches from free text (M3-01).
- City strength and act detail (M2-02, M2-03).
- Persisting confirmations beyond the run.

## Acceptance Criteria

- [ ] `classifyMatch` unit tests over recorded search fixtures cover `exact`, `ambiguous`, `none`, unicode names, and whitespace/case variants; all pass.
- [ ] A slate request containing an ambiguous act returns `awaiting_confirmation`, performs zero compare calls (asserted via the adapter call counter), and `POST .../confirm` completes it.
- [ ] A confirm request with an `entityId` not in the earlier candidate list is rejected with the standard error format.
- [ ] Two inputs resolving to one entity yield one act plus a note; a crowd act equal to a candidate is excluded with a note (tests).
- [ ] The confirmation screen disables Rank until all ambiguities are resolved (component test) and works by keyboard only.
- [ ] Entity names containing `<script>` or `&filter.type=` render as inert plain text and never alter an outgoing request (test).
- [ ] The ui-reviewer agent pass is recorded with no blocking findings.

## Deliverables

- `packages/core/src/matching.ts` and `matching.test.ts`
- `apps/web/app/api/slates/[runId]/confirm/route.ts`; schema additions in `packages/contracts` (or the shared zod location from M1-03)
- `apps/web/app/(app)/confirm/` screen and components
- `fixtures/qloo/search-ambiguous-*.json` references (recorded in M0-02)

## Validation Gate

```bash
export DEMO_MODE=fixtures
npm ci && npm run lint && npm run typecheck
npx vitest run packages/core/src/matching.test.ts apps/web
npm run build
npm run start -- -p 3107 & PID=$!; sleep 6
curl -s -X POST localhost:3107/api/slates -H 'content-type: application/json' \
  -d @fixtures/requests/ambiguous-room.json | jq -e '.status=="awaiting_confirmation" and (.matches|length>0)'
kill $PID
./scripts/check-no-secrets.sh
```

## Handoff

- M2-02 and M2-03 operate on confirmed acts only.
- M2-06 (sample rooms) pre-confirms its rooms through this flow.
- M2-GATE walks the "confirm matches" storyboard step on production.
