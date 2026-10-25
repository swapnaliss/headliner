---
title: "M1-01 · Qloo adapter: typed params, shape assertions, cache read-through, redacted Evidence"
milestone: "M1 · Walking Skeleton"
labels: ["backend", "critical"]
blocked_by: ["M0-02", "M0-05", "M0-GATE"]
estimate: "4h"
resources: ["QLOO"]
needs: [P-02, P-07, P-10]
---

## Context

Rubric: Technological Implementation. Every number in Headliner traces to a Qloo response, and Qloo silently ignores invalid parameters and returns 200 (CLAUDE.md), so the adapter is the one place where correctness, safety and reliability of the Qloo integration are enforced (ADR 0012, ADR 0007, ADR 0002, ADR 0008). Everything downstream (M1-03 pipeline, M2-03 heatmaps, M3-04 proof) calls Qloo only through this module.

## Scope

A `qloo` workspace package (`packages/qloo`) exposing one interface with typed methods named like the harness workflows (ADR 0012): `search(query, type)`, `recommend(signalEntityIds)` (insights), `compareAudiences(aIds, bIds)`, `whereIsPopular(entityId, city)` (heatmap) and a documented non-signal `trending()`.

1. **Typed params.** Each method takes a zod-validated typed object and builds the query with `URLSearchParams`; no user string is ever concatenated into a URL. Names are capped at 80 characters, entity-id lists capped per ADR 0003 limits.
2. **Response-shape assertions.** A zod schema per endpoint (`results[]` with `entity_id`, `name`, `popularity`, `tags`, `properties` for search; `results.entities[]` for insights; `results.tags[]` with scores for compare; `results.heatmap[]` cells with `location` and `query.{affinity, affinity_rank, popularity}` for heatmap). A 200 whose shape does not match raises a typed `QlooShapeError`.
3. **Reliability (ADR 0007).** 10 s timeout through `AbortSignal.timeout`; one retry with jitter on timeout, 429 and 5xx only; a concurrency cap of 6 in-flight calls (a small semaphore); no retry on 4xx other than 429.
4. **Cache read-through (ADR 0002).** Key = hash of endpoint plus the canonical typed params. Read from `qloo_cache` (M0-05 Drizzle module) before calling; write after a successful, shape-valid response with a TTL; heatmaps store aggregates only. A `CacheStore` interface with a Postgres implementation and an in-memory implementation (used by tests and DEMO_MODE).
5. **Transport seam.** A `QlooTransport` interface with a live `fetch` implementation (base URL `https://hackathon.api.qloo.com`, key read from server env only) and a `FixtureTransport` that replays `fixtures/qloo/` recordings from M0-02 keyed by endpoint and canonical params. The pipeline cannot tell them apart.
6. **Redacted Evidence.** Every call returns the data plus an `Evidence` record `{endpoint, redactedParams, responseDigest, fetchedAt}`; the `X-Api-Key` header is never stored, logged or returned; `responseDigest` is a SHA-256 of the canonical response.
7. **No raw upstream errors.** All failures map to a closed error union (`QlooTimeout`, `QlooRateLimited`, `QlooUnavailable`, `QlooShapeError`, `QlooBadRequest`) with a safe message; upstream bodies and headers never appear in a thrown message.

## Out of scope

Scoring (M1-02), the HTTP route (M1-03), per-IP budgets (M2-05), heatmap aggregation to mean `affinity_rank` (M2-03; this ticket only fetches and validates the heatmap response), structured request logging (M3-05).

## Acceptance Criteria

- [ ] `npm test -w packages/qloo` passes with no network and no key, replaying `fixtures/qloo/` for search, insights, compare, heatmap and trending.
- [ ] A test feeds act names containing `&filter.type=`, `#`, `%00`, spaces and 80+ characters; the built URL contains exactly the expected parameter set (asserted by parsing the URL), and over-long names are rejected.
- [ ] A test with a 200 response of the wrong shape (for each endpoint) raises `QlooShapeError`.
- [ ] A test with a fake transport proves: timeout at 10 s (fake timers), exactly one retry with jitter on 429/5xx/timeout, zero retries on 400, never more than 6 concurrent in-flight calls across 20 parallel requests.
- [ ] A test proves cache read-through: second identical call makes zero transport calls and returns the same data; an expired entry refetches; an upstream failure with a stale entry present returns the stale data flagged `stale: true` (ADR 0007).
- [ ] A test asserts no Evidence, thrown error or log line contains the string used as the API key in the test env or the text `X-Api-Key`.
- [ ] A test asserts upstream error bodies never appear in `QlooError.message`.
- [ ] One live smoke test (skipped unless `QLOO_LIVE=1`) performs one search and one compare against the hackathon base URL and passes the shape assertions.

## Deliverables

- `packages/qloo/src/client.ts`, `params.ts`, `schemas.ts`, `errors.ts`, `evidence.ts`, `limiter.ts`, `cache.ts`, `transport/live.ts`, `transport/fixture.ts`, `index.ts`
- `packages/qloo/test/*.test.ts`
- `packages/qloo/README.md` (module contract, three paragraphs)

## Validation Gate

```bash
set -euo pipefail
export TMPDIR="${TMPDIR:-/tmp}"
unset QLOO_API_KEY QLOO_LIVE DATABASE_URL
npm ci
npm run typecheck -w packages/qloo
npm run lint -w packages/qloo
npm test -w packages/qloo -- --reporter=dot
# no key material or auth header persisted anywhere in the package
! grep -rniE "x-api-key" packages/qloo/src --include=*.ts | grep -v "transport/live.ts"
# no string concatenation of URLs with user input
! grep -rnE "hackathon\.api\.qloo\.com/[^\"'\`]*\\$\{" packages/qloo/src
gitleaks detect --no-banner --redact -s . >/dev/null
```

## Handoff

M1-03 (create-slate pipeline) imports the `QlooClient` interface, `FixtureTransport` for DEMO_MODE and the `Evidence` type. M2-03 uses `whereIsPopular`; M2-05 wraps the live transport with budget counting; M3-04 uses the live transport. Provide in the package README the exact method signatures and error union.
