---
title: "M2-05 · Abuse protection and budgets: per-IP daily limits, global ceiling failing closed"
milestone: "M2 · Core Loop"
labels: ["backend", "security"]
blocked_by: ["M1-GATE"]
estimate: "3h"
resources: []
needs: []
---

## Context

The demo must be free and unrestricted for judges (no login, no CAPTCHA) yet cannot let a stranger burn the Qloo quota or the $15 LLM cap (risk register, R6, R8). ADR 0008: per-IP daily budgets in Postgres using the platform client IP header, a global daily ceiling that fails closed to deterministic mode, input caps. In-memory limits do not work on serverless.

## Scope

- `packages/budgets`:
  - `clientIp(headers)`: reads the platform-provided header (`x-forwarded-for` first hop as set by the host, or the host's dedicated header; documented in the module header and ADR 0008 note); never trusts a client-supplied value beyond what the host appends. Missing or malformed IP maps to a single shared bucket.
  - `ipHash(ip, day)`: salted SHA-256 (salt from env `BUDGET_SALT`, name only documented), so raw IPs are never stored.
  - `charge({ ipHash, day, qlooCalls, llmTokens })`: a single atomic upsert on `budgets(ip_hash, day, qloo_calls, llm_tokens)` returning the new totals (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`), so concurrent requests cannot overshoot.
  - Config constants with defaults: per-IP daily Qloo calls (default 150), per-IP daily LLM tokens (default 20,000), global daily Qloo calls and LLM tokens ceilings (defaults documented in `docs/budget.md` terms). All overridable by env, validated by zod.
  - `guard(request, cost)`: returns `allow` or `deny{reason}`. Cache hits cost 0. Global ceiling exceeded for LLM spend returns `deterministic_only` (the agent layer degrades, never errors); global Qloo ceiling exceeded serves cache and fixtures-backed samples only; if the budget store itself is unreachable it fails closed (denies metered work, still serves cached slates).
- Wire `guard` into the slate-create route (M1-03), the confirm route (M2-01) and the city route (M2-03) before any Qloo call; denial returns the standard error format with a plain "daily demo limit reached" message and `Retry-After` at the next UTC midnight; no upstream detail.
- Input caps enforced by zod at the edge: 12 candidates, 6 crowd acts, 5 cities, name length 80, request body max 16 KB, control characters rejected.
- Visible demo-limits note on the intake screen (built to `docs/design/screen-room-setup.md`): states the daily per-visitor limit and that cached sample rooms are always available. No login, no CAPTCHA. ui-reviewer pass required.
- DEMO_MODE=fixtures: budgets disabled (no DB); the note says so.

## Out of scope

- LLM token accounting inside the agent (M3-01 calls `charge`; this ticket provides it).
- IP reputation, geoblocking, CAPTCHA, login.

## Acceptance Criteria

- [ ] Concurrency test: 50 parallel `charge` calls of 1 against a Postgres test database end with exactly 50 recorded, never fewer.
- [ ] A request exceeding the per-IP limit is denied with status 429, `Retry-After`, and a generic message; a different IP is unaffected.
- [ ] With the global ceiling reached, an LLM-consuming path returns the deterministic result rather than an error; the Qloo path serves cached data only.
- [ ] With the budget store unreachable, metered work is denied (fail closed) and a cached slate still loads (test with a broken connection string).
- [ ] No raw IP appears in the database or logs (test inspects the row and captured log output).
- [ ] A 13th candidate, 7th crowd act, 6th city, an 81-character name and a 20 KB body are each rejected by schema (table-driven test).
- [ ] The intake screen shows the demo-limits note (component test); the ui-reviewer pass is recorded.

## Deliverables

- `packages/budgets/src/{ip,charge,guard,config}.ts` and tests
- Drizzle migration touch-ups if `budgets` needs an index (otherwise none)
- Guard wiring in the three routes; demo-limits component on the intake screen
- ADR 0008 addendum line naming the IP header used

## Validation Gate

```bash
export TEST_DATABASE_URL="${TEST_DATABASE_URL:?set to a throwaway Postgres branch}"
npm ci && npm run lint && npm run typecheck
npx vitest run packages/budgets apps/web
OUT=$TMPDIR/m2-05; mkdir -p "$OUT"
npx vitest run packages/budgets --reporter=verbose > "$OUT/b.txt" 2>&1; grep -cE 'FAIL' "$OUT/b.txt"   # expect 0
DEMO_MODE=fixtures npm run build
./scripts/check-no-secrets.sh
```

## Handoff

- M2-03 and M2-01 routes call `guard`.
- M3-01 and M3-02 call `charge` for LLM tokens and honour `deterministic_only`.
- M3-05 logs `deny` events (without IPs).
- M4-03 re-verifies that no raw IP or header is stored.
