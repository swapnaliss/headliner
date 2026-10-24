---
title: "M1-GATE · M1 gate: thin slice in production and DEMO_MODE=fixtures from a clean clone"
milestone: "M1 · Walking Skeleton"
labels: ["gate"]
blocked_by: ["M1-01", "M1-02", "M1-03", "M1-04", "M1-05", "M0-GATE"]
estimate: "1h"
resources: []
needs: []
---

## Context

The walking skeleton is only real if a stranger can run it. This gate proves, from evidence and not from claims, that one thin slice (room in, ranked slate out, evidence attached) works on the production URL and from a fresh clone with zero keys (ADR 0011). Every M2 ticket is blocked on this gate. It covers all rubric criteria at skeleton depth: Technological Implementation (adapter, core, pipeline), Design (specs and deployed UI), and the Stage 1 requirement of a working hosted demo.

## Scope

1. Verify each M1 ticket's acceptance criteria and Validation Gate was met (M1-01 through M1-05) and that every PR is merged green on main.
2. **Clean-clone zero-key run.** Clone the repository into `$TMPDIR` fresh, with no `.env`, no `node_modules` and no keys in the environment; run install, tests, build and the app with `DEMO_MODE=fixtures`; post the recorded demo room and check the Slate.
3. **Production check.** Load the production URL, check `/api/health`, check the Banner, submit the demo room (live mode, may use the cache), and confirm a ranked slate with Evidence is returned.
4. **Safety checks.** gitleaks on the working tree and history, grep the client bundle for key material and the Qloo hostname, confirm the response and logs never include `X-Api-Key` or raw upstream errors, confirm licence file is MIT.
5. **CI.** The latest CI run on main is green within the 5-minute target (R9).
6. Run the `ui-reviewer` agent on the deployed pages against `docs/design/`; record result.
7. Record the results in `docs/evidence/m1-gate.md` with date, commit SHA, production URL and the output of each command (no secrets).

## Out of scope

Anything from M2 onward (match confirmation, act detail, city strength, sharing, budgets, sample rooms). If a check fails, the failing ticket is reopened and fixed; scope is not reduced.

## Acceptance Criteria

- [ ] A fresh clone with no keys installs, tests, builds and serves in `DEMO_MODE=fixtures`, and `POST /api/slates` with the recorded room returns a ranked Slate with Evidence.
- [ ] The production URL returns 200 on `/` and `/api/health`, shows the Banner, and a production run returns a ranked Slate.
- [ ] CI is green on main and finished in 5 minutes or less.
- [ ] gitleaks reports no findings; no client chunk contains `X-Api-Key` or the Qloo hostname.
- [ ] `LICENSE` is MIT.
- [ ] `docs/evidence/m1-gate.md` exists and lists SHA, URL and results.
- [ ] `ui-reviewer` found no unresolved blocking findings on the deployed pages.

## Deliverables

- `docs/evidence/m1-gate.md`
- `scripts/m1-gate.sh` (runs the clean-clone portion; reused by M2-GATE and M4-GATE)

## Validation Gate

```bash
set -euo pipefail
export TMPDIR="${TMPDIR:-/tmp}"
REPO_URL="$(git remote get-url origin)"
WORK="$(mktemp -d "$TMPDIR/m1-gate.XXXXXX")"
git clone --depth 1 "$REPO_URL" "$WORK/clone"
cd "$WORK/clone"
env -u QLOO_API_KEY -u ANTHROPIC_API_KEY -u DATABASE_URL DEMO_MODE=fixtures bash -c '
  set -euo pipefail
  npm ci
  npm run typecheck && npm run lint
  npm test -- --reporter=dot
  npm run build -w apps/web
  PORT=3918 npm run start -w apps/web >"'"$WORK"'/server.log" 2>&1 &
  SRV=$!; trap "kill $SRV 2>/dev/null || true" EXIT
  for i in $(seq 1 30); do curl -sf localhost:3918/api/health >/dev/null && break; sleep 1; done
  curl -sf -X POST localhost:3918/api/slates -H "content-type: application/json" \
    --data @apps/web/test/fixtures/room.json | tee "'"$WORK"'/slate.json" | grep -q "\"evidence\""
  ! grep -iE "x-api-key" "'"$WORK"'/slate.json" "'"$WORK"'/server.log"
  ! grep -rlE "X-Api-Key|hackathon\.api\.qloo\.com" apps/web/.next/static
'
gitleaks detect --no-banner --redact -s . >/dev/null
grep -q "MIT License" LICENSE
URL="$(grep -oE 'https://[^ )]+' docs/evidence/deploy.md | head -1)"
curl -sfL "$URL/api/health" >/dev/null
curl -sfL "$URL/" | grep -q "aggregate affinity, not a ticket forecast"
gh run list --branch main --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success
test -s docs/evidence/m1-gate.md
```

## Handoff

M2-01 to M2-05 start only after this gate passes. M2-GATE and M4-GATE reuse `scripts/m1-gate.sh` for their clean-clone portion. The production URL and demo room recorded here are the baseline for M2-06 sample rooms and M3-05 uptime checks.
