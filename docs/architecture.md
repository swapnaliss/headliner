# Headliner: system design

Headliner is an agent that ranks the acts an independent venue is considering and shows, with checkable Qloo evidence, how well each act's audience tastes fit the venue's regular crowd. This document is the public system design. Each decision links to its ADR.

## 1. Requirements

| # | Requirement | Number | Status |
|---|---|---|---|
| R1 | Slate for up to 12 acts: latency | p95 <= 12 s cold, <= 2 s warm cache | partly measured: the Qloo side of a cold 6 x 12 slate took 4,988 ms and 5,555 ms (2 runs, `docs/evidence/qloo-cold-slate.md`); a stored sample page answered in 1.72 s after more than 8 minutes idle (one client, `docs/evidence/m2-gate.md`). No p95 is claimed. |
| R2 | Load | about 50 judge sessions in the judging week; 100x = 5,000 slates/week | assumed, not measured |
| R3 | Qloo calls per slate | 30 (18 resolves + 12 compares); city detail up to 5 heatmap calls per act opened | measured: 30 calls by the list-compare plan, 39 live calls on a cold run because 9 were HTTP 429 and retried once (`docs/evidence/qloo-latency.md`, `docs/evidence/qloo-cold-slate.md`); the daily quota is not observable from responses |
| R4 | Availability | demo up through 2026-11-05; RTO <= 30 min | target; `/api/health` and an external monitor (ADR 0010); RTO not exercised |
| R5 | Data | no personal data collected; resolved entity names only; < 100 MB | derived |
| R6 | Security | key server-side; per-IP budgets; spend cap; free unrestricted judge access, no login | known (rules) |
| R7 | Global | any city string, UTF-8 names, WCAG 2.2 AA, mobile-first | known/assumed |
| R8 | Budget | small fixed ceiling; LLM spend capped provider-side and in code | LLM spend recorded about 0.0077 USD in total by the M3 gate (`docs/evidence/m3-gate.md`) |
| R9 | Feedback loops | local check <= 2 min, PR CI <= 5 min, reset <= 2 min | CI run 149 s on one main commit (`docs/evidence/m2-gate.md`, n=1); the others not measured |
| R10 | Licence | MIT, visible in repo About | known (rules) |

## 2. Domain model

- **Modules** (ADR 0001): `core` (scoring, evidence, caveats; no I/O imports), `qloo` (adapter and cache), `agent` (LLM at the edges), `slates` (persistence and sharing), `web` (UI and route handlers).
- **Entities**: Room {city, crowdActs[]}; Act {qlooEntityId, name, matchConfidence}; Run; Slate; ActResult {fit, overlapTags[], standing, cityStrengths[], caveats[], evidence[]}; Evidence {endpoint, redactedParams, responseDigest, fetchedAt}.
- **Invariants**: every number in an ActResult has at least one Evidence; scores are computed by code, never by the LLM; an ambiguous match blocks ranking until confirmed; thin city data (under 15 heatmap cells) always carries a caveat; nothing is derived about an individual.
- **Run state machine**: draft -> matching -> awaiting_confirmation -> scoring -> done | failed (partial results kept; a failed act shows "no data").

## 3. Decisions

| Area | Decision | ADR |
|---|---|---|
| Style | Modular monolith, TypeScript, Next.js | [0001](adr/0001-modular-monolith.md) |
| Data | Postgres: cache, 30-day slates, budgets | [0002](adr/0002-postgres-cache-and-slates.md) |
| API | Route handlers, shared zod schemas, hard input limits | [0003](adr/0003-api-and-contracts.md) |
| Sync/async | Request-bounded pipeline, lazy city detail | [0004](adr/0004-synchronous-pipeline.md) |
| Frontend | App Router, server components, WCAG AA | [0005](adr/0005-frontend.md) |
| Scaling | Stateless tier; cache is the lever | [0006](adr/0006-scaling-story.md) |
| Reliability | Timeouts, one retry, partial results, stale cache | [0007](adr/0007-reliability.md) |
| Security | Server-side key, shared-store budgets, hardened shared pages | [0008](adr/0008-security-and-abuse.md) |
| Agent | Deterministic pipeline with an LLM at the edges | [0009](adr/0009-agent-shape.md) |
| Observability | JSON logs and an uptime check | [0010](adr/0010-observability.md) |
| Delivery | Fixture-replay tests, zero-key DEMO_MODE | [0011](adr/0011-delivery-testing-demo-mode.md) |
| Qloo access | REST adapter | [0012](adr/0012-qloo-access-via-rest.md) |
| Fit | Fit = 100 x the mean Qloo tag score shared between a candidate's audience and the whole crowd, from one list compare per candidate (tags de-duplicated, at least 3 shared tags); standing is the Qloo popularity percentile against the crowd median; city strength is mean `affinity_rank` plus cell count, thin under 15 cells; ranking by Fit, then name | [0013](adr/0013-fit-formula.md) |

## 4. System diagram

```
Browser ──HTTPS──► Next.js app (serverless)
                     ├─ core: Fit, standing, city strength, caveats (pure)
                     ├─ agent: intake (<=3 steps) + templated explanation ──► OpenAI API     [untrusted text in, schema-validated out]
                     ├─ qloo adapter (timeout, 1 retry, shape assertions) ──► hackathon.api.qloo.com  [X-Api-Key stays server-side]
                     └─ Postgres: qloo_cache, slates (30-day TTL), budgets

DEMO_MODE=fixtures: the adapter reads fixtures/qloo, no database, no model call, no outbound request.
```

Routes (`apps/web/app/`): `POST /api/intake`, `POST /api/slates`, `GET /api/slates/[id]`, `POST /api/slates/[id]/confirm`, `GET /api/slates/[id]/acts/[actId]`, `POST /api/slates/[id]/acts/[actId]/cities`, `GET /api/health`; pages `/`, `/run/[runId]/confirm`, `/slates/[id]`, `/s/[id]` (shared, read-only; `/s/sample-<slug>` for the pinned sample rooms).

## 5. Data model

- `qloo_cache(key text pk, json jsonb, expires_at timestamptz)`: key is a hash of endpoint and typed params. Heatmaps stored as aggregates.
- `slates(id text pk (nanoid 21), json jsonb, created_at, expires_at)`.
- `budgets(ip_hash text, day date, qloo_calls int, llm_tokens int, pk(ip_hash, day))`.

## 6. Security, reliability, scaling

See ADRs 0006 to 0008. Threats considered on the core flow: key theft (server-only), parameter injection via act or city strings (typed params, URLSearchParams), prompt injection (LLM sees structured fields only, templated sentences, injection eval set in CI), cost exhaustion (per-IP and global budgets that fail closed to deterministic mode), stored abuse on shared pages (unguessable ids, resolved names only, noindex, TTL, CSP).

## 7. Agent architecture

The product is a deterministic pipeline with an LLM at the edges (ADR 0009). The LLM never computes a number. Guardrails: input length and character limits; schema-validated output; a grounding check that fails any number not present in the Slate; max 3 intake steps; token and spend caps; read-only tools.

Intake loop (M3-01, `packages/agent/src/intake/`, provider seam `packages/agent/src/llm/`). Constants, all in code and covered by tests:

| Constant | Value | Where |
|---|---|---|
| `MAX_INTAKE_STEPS` | 3 model turns; the last turn offers `submit_room` only | `intake/schema.ts` |
| Input | at most 500 characters (measured raw); control, line and paragraph separators rejected; tab and newline become spaces; empty rejected | `intake/guardrails.ts` |
| Output | 6 crowd acts, 12 candidates, 5 cities, names 80 characters; over-limit output is rejected and retried, not truncated; every name must appear in the sentence | `intake/schema.ts`, `guardrails.ts` |
| `TURN_MAX_COMPLETION_TOKENS` | 1,500 per turn (reasoning tokens are billed as output and count against it) | `intake/loop.ts` |
| `MAX_RUN_TOKENS`, `MAX_RUN_COST_USD` | 9,000 tokens and 0.01 USD per run; at either the run returns `mode: "deterministic"` | `intake/loop.ts` |
| `MAX_PROPOSE_CALLS` | 18 read-only Qloo searches per run (6 + 12); also the Qloo calls reserved by the route | `intake/tools.ts` |
| Per-IP and global LLM tokens | 20,000 and 100,000 per UTC day (`BUDGET_*_LLM_TOKENS`), reserved before every turn through the M2-05 guard; a ceiling, a denial or an unreachable store means no model call | `apps/web/src/budget.ts` |
| Default model | `gpt-5-nano` ($0.05 in, $0.40 out per 1M tokens), override `LLM_MODEL`; no `temperature` or `top_p` is sent (reasoning models reject them), `reasoning_effort: minimal` | `llm/pricing.ts`, `llm/openai.ts` |

The model sees the sentence in a delimited data block, never in the system prompt, and tool results are limited to `entity_id`, `name`, `popularity`. The room it returns is a proposal that still goes through match confirmation.

## 8. Scaling story and cost at 100x

5,000 slates a week at 30 calls is 150k uncached Qloo calls; at an assumed 70% cache hit about 45k (the cache hit rate is not measured; a cold run also spends retries on HTTP 429, 39 calls instead of 30 in the recorded runs). The app tier is stateless. Hosting and database stay on free tiers; the LLM is the only metered cost and is capped.

## 9. One-line checks per principle

| Principle | Where it is checked |
|---|---|
| Scores are computed by code; the LLM never computes a number | `packages/core/test/`; grounding and injection evals, 106 cases, 1,391 assertions, 0 failed (`docs/evidence/agent-evals.md`) |
| Every number has Evidence; the key header is never stored or shown | `packages/qloo/test/redaction.test.ts`, `apps/web/test/log.test.ts`, `apps/web/test/slates.route.test.ts` |
| Invalid Qloo parameters are ignored silently, so shape is asserted | `packages/qloo/test/shape.test.ts`, `packages/qloo/test/params.test.ts` |
| Thin city data always carries a caveat | `packages/core/test/rank-caveats-invariants.test.ts` |
| Zero-key mode needs no key, database or model | `scripts/demo-mode-smoke.sh`, `packages/qloo/test/fixtures-replay.test.ts` |
| Limits and budgets are enforced server-side, failing closed | `apps/web/test/budget.route.test.ts` |
| Shared pages are hardened | `apps/web/test/security-headers.test.ts`, `apps/web/test/shared.test.tsx` |
| Claims are measured on recorded data | `docs/evidence/home-city-check.md` (12 of 15), `docs/evidence/fit-sanity.md` (11 of 12), both re-computed by `npm run proof` |
