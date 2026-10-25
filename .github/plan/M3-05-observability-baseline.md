---
title: "M3-05 · Observability baseline: JSON logs and uptime check"
milestone: "M3 · Agent Layer & Proof"
labels: ["infra", "backend"]
blocked_by: ["M2-GATE"]
estimate: "1h"
resources: ["DEPLOY"]
needs: [P-15]
---

## Context

Rubric: Technological Implementation (reliability story, ADR 0010). The demo must stay up through 2026-11-05 and the owner must see a failure fast. ADR 0010 chooses structured console JSON logs plus an external uptime check, and forbids logging headers.

## Scope

- `packages/web/src/log.ts` (or the shared logger module) with `logEvent({runId, endpoint, latencyMs, status, cacheHit})` writing one JSON line to stdout. A run id (nanoid) is created per request and passed through the adapter, so each Qloo call and each route response logs with the same run id.
- Logged fields: run id, endpoint (Qloo path or route), latency, status, cache hit, and redacted params (parameter names plus the same redaction used for Evidence). Never headers, never the API key, never request bodies containing free text beyond the 80-char capped names.
- Middleware or wrapper applied to every route handler in `apps/web/app/api/` and to the Qloo adapter's fetch call; errors log a code, not the upstream body.
- `GET /api/health` returning `{ok, mode, db}` where `db` is a cheap `select 1` result; no secrets, no versions of private services.
- External uptime check on the demo URL hitting `/api/health`: a free monitor (for example UptimeRobot or Better Stack free tier) configured with an email alert; the console steps are recorded in `docs/runbook.md` with the monitor name (no tokens). A second repo-owned check: a scheduled GitHub Action `uptime.yml` that curls the demo URL and fails on non-200 as an independent signal.

## Out of scope

- Tracing stacks, dashboards, SLO alerting (ADR 0010 rejects them).
- Log shipping to a third party.

## Acceptance Criteria

- [ ] A test invokes a route and the adapter with a header-bearing request and asserts the emitted log lines parse as JSON, contain run id, endpoint, latency, status and cacheHit, and contain neither the header name `x-api-key` nor the value of the key env var (canary value used in the test).
- [ ] The same run id appears on the route log and its adapter logs in one slate request (test in fixtures mode).
- [ ] Raw upstream error text never appears in logs or client responses (test with a stub returning a secret-looking body).
- [ ] `/api/health` returns 200 with `ok: true` locally and on the deployed URL.
- [ ] The external monitor exists and `docs/runbook.md` records its name, interval and alert target type (no credentials); the scheduled workflow file exists and passes on manual dispatch.

## Deliverables

- `packages/web/src/log.ts`, wrapper usage in `apps/web/app/api/**` and `packages/qloo/src/adapter.ts`
- `apps/web/app/api/health/route.ts`
- `.github/workflows/uptime.yml`
- `docs/runbook.md` (monitoring section)
- Tests: `packages/web/src/log.test.ts`

## Validation Gate

```bash
export DEMO_MODE=fixtures
npm run lint && npm run typecheck
CANARY_KEY=canary-value-456 QLOO_API_KEY=canary-value-456 npm test -- packages/web/src/log.test.ts
LOG="${TMPDIR:-/tmp}/m3-05.log"
npm run dev > "$LOG" 2>&1 & PID=$!
sleep 8; curl -sS -H 'x-api-key: canary-value-456' http://localhost:3000/api/health | jq -e '.ok==true'
kill $PID
grep -c 'canary-value-456' "$LOG" | grep -qx 0
grep -E '^\{' "$LOG" | head -3 | jq -e '.runId and .endpoint and (.latencyMs!=null)'
curl -fsS "${DEMO_URL:?set to the deployed URL}/api/health" | jq -e '.ok==true'
```

## Handoff

- M3-GATE checks the monitor is green and the health endpoint answers on production.
- M4-03 audits logs for header and key leakage using the canary test.
- M4-01 mentions the baseline under reliability.
