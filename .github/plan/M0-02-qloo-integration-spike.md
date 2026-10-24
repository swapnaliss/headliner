---
title: "M0-02 · Qloo integration spike: record fixtures, measure latency and call counts"
milestone: "M0 · Recon & Bootstrap"
labels: ["recon", "backend", "blocker-risk"]
blocked_by: ["M0-01"]
estimate: "3h"
resources: ["QLOO"]
needs: []
---

## Context

Technological Implementation depends on a multi-endpoint Qloo chain whose latency, call count and quota are unknown (risk register, `PROJECT.md` section 10; requirements R1 and R3 in `docs/architecture.md` are "assumed, measured in M0-02"). Every later ticket replays the fixtures recorded here (ADR 0011), and ADR 0006's call arithmetic (30 calls per slate) is validated or corrected here. This is one of the few tickets that makes live Qloo calls; it is the only place where live calls are the point.

## Scope

Write a recorder, `scripts/qloo-record.ts` (run with `npx tsx`), that reads the key from the `QLOO_API_KEY` environment variable (loaded by the shell, never read from a file by the script and never printed), calls `https://hackathon.api.qloo.com` with header `X-Api-Key`, and writes responses to `fixtures/qloo/`. Parameters are built with `URLSearchParams` from typed objects. The recorder never writes request headers into any file.

Record, for a small real set (for example crowd acts from a Leipzig club and 5 candidate acts, plus Lagos, Berlin and Jakarta for heatmaps), one fixture per call, named `<endpoint>--<slug>.json`, each wrapped as `{ endpoint, params, status, recordedAt, latencyMs, body }`:

1. **search**: `/search?query&types=urn:entity:artist&take` (several names, including one ambiguous name, one with non-ASCII characters, one with no match). Check and record whether `popularity` is present on results and what it looks like (the input for audience standing, ADR 0013).
2. **insights**: `/v2/insights` with `filter.type=urn:entity:artist` and `signal.interests.entities`.
3. **compare**: `/v2/insights/compare` with `a.signal.interests.entities` and `b.signal.interests.entities`, returning `results.tags[]` with scores. **Test whether `a` accepts a list of several crowd entity ids** (comma-separated) and record the answer in the evidence file; if it does not, record how many compares one slate needs instead.
4. **heatmap**: `/v2/insights` with `filter.type=urn:heatmap`, `filter.location.query=<city>`, `signal.interests.entities=<id>`; cell counts for at least 5 cities, including one thin city (fewer than 15 cells) if one exists.
5. **trending**: `/v2/trending`, recorded and documented as a non-signal (flat in this environment, no momentum claims).
6. **Invalid-parameter behaviour**: one call with a deliberately bogus parameter, recording that it returns 200 with the parameter ignored (the reason for response-shape assertions).

Measure and write `docs/evidence/qloo-latency.md`: per endpoint, n calls, min, median, p95 and max latency in ms, response size, and the number of Qloo calls for a worked 6-crowd-act, 12-candidate slate under both the per-act compare plan and (if it works) the list-compare plan. State whether R1 (p95 12 s cold) and R3 (30 calls) hold, and say what changes if not.

**Probe quota and 429 behaviour gently**: a single sequential burst of at most 40 calls, concurrency 1 then 6, stopping at the first 429 or 5xx; record any `Retry-After` or rate-limit headers (names and values of non-secret response headers only) and the observed behaviour. Do not hammer.

Add `fixtures/qloo/README.md` listing every fixture, the call that produced it, the date, and a note that redistribution is pending the organiser answer (M0-04). Add a fixtures index `fixtures/qloo/index.json` mapping `(endpoint, normalised params)` to a file, used later by DEMO_MODE=fixtures and the adapter tests.

## Out of scope

- The adapter module and its retry, cache and Evidence logic (M1-01).
- The Fit formula (M0-03).
- Any LLM call.
- Writing the key anywhere, including fixtures, logs and evidence.

## Acceptance Criteria

- [ ] `fixtures/qloo/` contains at least one fixture for each of search, insights, compare, heatmap and trending, plus the invalid-parameter case, all valid JSON with the wrapper shape
- [ ] No fixture, log or evidence file contains the key or any header: `grep -r` for the key value (via the environment, not printed) returns nothing, and no file contains the string `X-Api-Key`
- [ ] `docs/evidence/qloo-latency.md` has the per-endpoint table, the call-count table for a 6 and 12 slate, the list-compare result, the search `popularity` result, the quota and 429 observations, and a verdict on R1 and R3
- [ ] Search fixtures include one ambiguous, one non-ASCII and one no-match query
- [ ] Heatmap fixtures cover at least 5 cities with cell counts listed
- [ ] `fixtures/qloo/index.json` resolves every fixture and `npm test` includes a test that every index entry exists and parses
- [ ] Total live calls made are recorded in the evidence file and stay within the burst limit above

## Deliverables

- `scripts/qloo-record.ts`
- `fixtures/qloo/*.json`, `fixtures/qloo/index.json`, `fixtures/qloo/README.md`
- `docs/evidence/qloo-latency.md`
- `packages/qloo/test/fixtures-index.test.ts`

## Validation Gate

```bash
set -euo pipefail
test -f docs/evidence/qloo-latency.md
for e in search insights compare heatmap trending; do ls fixtures/qloo/ | grep -q "^$e--" || { echo "missing $e fixture"; exit 1; }; done
find fixtures/qloo -name '*.json' -print0 | xargs -0 -n1 jq -e 'type' >/dev/null
jq -e 'length > 0' fixtures/qloo/index.json
# no key or header material anywhere in outputs (key is read from the environment by name, never printed)
if [ -n "${QLOO_API_KEY:-}" ]; then ! grep -rqF -- "$QLOO_API_KEY" fixtures docs scripts; fi
! grep -rqi 'x-api-key' fixtures docs/evidence
# replayable with no key and no network
env -i PATH="$PATH" HOME="$HOME" DEMO_MODE=fixtures npm test --silent -- packages/qloo
grep -q 'p95' docs/evidence/qloo-latency.md
grep -qi 'list' docs/evidence/qloo-latency.md
./scripts/check-no-secrets.sh
```

## Handoff

- M0-03 reads the compare, insights and search fixtures to define Fit and standing.
- M0-05 needs nothing from this ticket, but M1-01 depends on the fixtures, the index, the shape findings and the latency and quota evidence (timeout, concurrency cap and retry choices).
- M1-03 uses the fixtures for DEMO_MODE=fixtures.
- If the list-compare test fails or the quota is low, M1-01 and ADR 0006 take the measured numbers; this ticket records them and does not change scope.
