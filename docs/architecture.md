# Headliner: system design

Headliner is an agent that ranks the acts an independent venue is considering and shows, with checkable Qloo evidence, how well each act's audience tastes fit the venue's regular crowd. This document is the public system design. Each decision links to its ADR.

## 1. Requirements

| # | Requirement | Number | Status |
|---|---|---|---|
| R1 | Slate for up to 12 acts: latency | p95 <= 12 s cold, <= 2 s warm cache | assumed, measured in M0-02 |
| R2 | Load | about 50 judge sessions in the judging week; 100x = 5,000 slates/week | assumed |
| R3 | Qloo calls per slate | up to 30 (6 crowd + 12 candidate resolves + 12 compares); city detail up to 5 heatmap calls per act opened | derived, validated in M0-02; quota unknown |
| R4 | Availability | demo up through 2026-11-05; RTO <= 30 min | assumed |
| R5 | Data | no personal data collected; resolved entity names only; < 100 MB | derived |
| R6 | Security | key server-side; per-IP budgets; spend cap; free unrestricted judge access, no login | known (rules) |
| R7 | Global | any city string, UTF-8 names, WCAG 2.2 AA, mobile-first | known/assumed |
| R8 | Budget | <= $20 total | assumed |
| R9 | Feedback loops | local check <= 2 min, PR CI <= 5 min, reset <= 2 min | assumed |
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
| Fit | Defined by M0-03 | [0013](adr/0013-fit-formula.md) |

## 4. System diagram

```
Browser ──HTTPS──► Next.js app (serverless)
                     ├─ core: Fit, standing, city strength, caveats (pure)
                     ├─ agent: intake (<=3 steps) + templated explanation ──► OpenAI API     [untrusted text in, schema-validated out]
                     ├─ qloo adapter (timeout, 1 retry, shape assertions) ──► hackathon.api.qloo.com  [X-Api-Key stays server-side]
                     └─ Postgres: qloo_cache, slates (30-day TTL), budgets
```

## 5. Data model

- `qloo_cache(key text pk, json jsonb, expires_at timestamptz)`: key is a hash of endpoint and typed params. Heatmaps stored as aggregates.
- `slates(id text pk (nanoid 21), json jsonb, created_at, expires_at)`.
- `budgets(ip_hash text, day date, qloo_calls int, llm_tokens int, pk(ip_hash, day))`.

## 6. Security, reliability, scaling

See ADRs 0006 to 0008. Threats considered on the core flow: key theft (server-only), parameter injection via act or city strings (typed params, URLSearchParams), prompt injection (LLM sees structured fields only, templated sentences, injection eval set in CI), cost exhaustion (per-IP and global budgets that fail closed to deterministic mode), stored abuse on shared pages (unguessable ids, resolved names only, noindex, TTL, CSP).

## 7. Agent architecture

The product is a deterministic pipeline with an LLM at the edges (ADR 0009). The LLM never computes a number. Guardrails: input length and character limits; schema-validated output; a grounding check that fails any number not present in the Slate; max 3 intake steps; token and spend caps; read-only tools.

## 8. Scaling story and cost at 100x

5,000 slates a week at up to 30 calls is 150k uncached Qloo calls; at a 70% cache hit about 45k. The app tier is stateless. Hosting and database stay on free tiers; the LLM is the only metered cost and is capped.
