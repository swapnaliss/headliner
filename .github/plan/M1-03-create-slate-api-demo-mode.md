---
title: "M1-03 · Create-slate API and DEMO_MODE=fixtures"
milestone: "M1 · Walking Skeleton"
labels: ["backend", "critical"]
blocked_by: ["M1-01", "M1-02", "M0-GATE"]
estimate: "3h"
resources: []
needs: []
---

## Context

Rubric: Technological Implementation (multi-endpoint chain, evidence) and the hard requirement that judges can run the project from a clean clone with no keys (ADR 0011, ADR 0003, ADR 0004). This ticket wires the adapter and the scoring core into the first end-to-end path: Room plus candidate acts in, Slate with Evidence out.

## Scope

1. **Route.** `POST /api/slates` in `apps/web/app/api/slates/route.ts`. The request body is validated with a shared zod schema (`packages/core` or `packages/shared`): `city` string up to 80 chars, 3 to 6 `crowdActs`, 1 to 12 `candidateActs` (ADR 0003: max 12 candidates, 6 crowd, 5 cities, name length 80), UTF-8 names, control characters rejected. Violations return a single error format `{error:{code,message}}` with HTTP 400.
2. **Pipeline (ADR 0004).** `apps/web/src/pipeline/createSlate.ts`: resolve every crowd and candidate name through `search` (top candidate plus confidence, ambiguous results flagged for M2-01) with concurrency from the adapter; for each resolved candidate call `compareAudiences(crowdIds, [candidateId])`; score with `core`; build `ActResult` with `Evidence[]`; rank. A failed act becomes a `no-data` result with a caveat; the run still returns (partial results kept, ADR 0007). Runs within a request-bounded budget and never fans out beyond the adapter's cap.
3. **Run state.** Return `status: "done"` or `"awaiting_confirmation"` per the state machine in docs/architecture.md §2; in this ticket ambiguity is reported, the confirmation UI is M2-01.
4. **Persistence.** In live mode the Slate is stored in `slates` (M0-05) with a nanoid(21) id and returned as `{id, slate}`. In fixtures mode the Slate is returned and held in an in-memory store.
5. **DEMO_MODE=fixtures (ADR 0011).** One server-side config module `apps/web/src/config.ts` reads `DEMO_MODE`; when `fixtures` it wires `FixtureTransport` and the in-memory `CacheStore`, requires no `DATABASE_URL`, `QLOO_API_KEY` or `ANTHROPIC_API_KEY`, and makes zero outbound network calls. An act name with no recorded fixture returns an honest `no-data` result, not an error. `GET /api/health` reports the mode.
6. **Safe errors.** Upstream error details never reach the client; the route returns generic codes (`upstream_unavailable`, `invalid_input`, `rate_limited`).
7. **README.** Add the exact clean-clone command sequence for `DEMO_MODE=fixtures` to README (the run path created in M0-01).

## Out of scope

UI (M1-05), confirmation flow UI (M2-01), per-IP budgets (M2-05), LLM intake and explanation (M3-01, M3-02), heatmaps (M2-03), share-page hardening (M2-04).

## Acceptance Criteria

- [ ] With `DEMO_MODE=fixtures` and all keys unset, `POST /api/slates` with a recorded room returns 200 with ranked `ActResult`s, each with Fit, overlap tags, standing labelled "Qloo popularity rank", caveats and at least one Evidence per number.
- [ ] Over-limit input (13 candidates, 7 crowd acts, 81-char name, empty city, control characters) returns 400 with the single error format; none reach the adapter (asserted with a spy).
- [ ] An act with no fixture yields a `no-data` result and the other acts are still ranked.
- [ ] The response and logs contain no `X-Api-Key`, no key-shaped strings and no raw upstream error text (asserted in a test that forces adapter errors).
- [ ] A test with outbound network blocked (Node `--no-network` equivalent: stubbed `fetch` that throws) passes the full pipeline in fixtures mode.
- [ ] Integration test with a fake Qloo transport covers an ambiguous match (returns `awaiting_confirmation`) and a duplicate act.
- [ ] `GET /api/health` returns `{"mode":"fixtures"}` under `DEMO_MODE=fixtures`.

## Deliverables

- `apps/web/app/api/slates/route.ts`, `apps/web/app/api/health/route.ts`
- `apps/web/src/pipeline/createSlate.ts`, `apps/web/src/config.ts`, `apps/web/src/errors.ts`
- `apps/web/test/slates.route.test.ts`, `apps/web/test/pipeline.test.ts`
- README section "Run with no keys (DEMO_MODE=fixtures)"

## Validation Gate

```bash
set -euo pipefail
export TMPDIR="${TMPDIR:-/tmp}"
unset QLOO_API_KEY ANTHROPIC_API_KEY DATABASE_URL
export DEMO_MODE=fixtures
npm ci
npm run typecheck && npm run lint
npm test -w apps/web -- --reporter=dot
npm run build -w apps/web
PORT=3917 npm run start -w apps/web >"$TMPDIR/m1-03-server.log" 2>&1 &
SRV=$!; trap 'kill $SRV 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf localhost:3917/api/health >/dev/null && break; sleep 1; done
curl -sf localhost:3917/api/health | grep -q fixtures
# body comes from a recorded room listed in fixtures/qloo/ (see apps/web/test/fixtures/room.json)
curl -sf -X POST localhost:3917/api/slates -H 'content-type: application/json' \
  --data @apps/web/test/fixtures/room.json | tee "$TMPDIR/m1-03-slate.json" | grep -q '"evidence"'
test "$(curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3917/api/slates -H 'content-type: application/json' -d '{"city":""}')" = 400
! grep -iE "x-api-key|api[_-]?key" "$TMPDIR/m1-03-slate.json" "$TMPDIR/m1-03-server.log"
```

## Handoff

M1-05 (UI) posts to `/api/slates` and renders the `Slate` type. M2-01 consumes `awaiting_confirmation`; M2-02 reads `Evidence`; M2-04 reuses the stored Slate; M2-05 wraps the route with budgets; M3-01 and M3-02 feed the same endpoint and render the same `Slate` fields. The recorded demo room in `apps/web/test/fixtures/room.json` is reused by M1-05 and M1-GATE.
