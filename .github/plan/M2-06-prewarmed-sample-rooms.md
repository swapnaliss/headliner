---
title: "M2-06 · Pre-warmed sample rooms: cached, pinned real rooms and a one-click sample"
milestone: "M2 · Core Loop"
labels: ["backend", "frontend"]
blocked_by: ["M2-01", "M2-03", "M1-GATE"]
estimate: "1.5h"
resources: ["QLOO", "DEPLOY"]
needs: []
---

## Context

A judge with no ideas and a cold cache could wait up to the p95 cold latency (R1) or hit a quota limit. Pre-warmed real rooms give a fast first run, keep the "first-time judge completes the core journey in under 3 minutes" metric achievable, and survive budget exhaustion (M2-05). The data is real Qloo data (data policy): rooms are chosen by a person, results are real responses.

## Scope

- `scripts/prewarm-samples.ts`: reads `apps/web/samples/rooms.json` (2 or 3 rooms, for example a Leipzig venue and a Berlin venue; each with city, 3 to 6 crowd acts, 5 candidate acts, all names verified to resolve unambiguously, or with the confirmations pre-recorded in the file), runs the full pipeline through the production adapter (live Qloo, key from env, never printed), including city strength for the top act and the nearby cities, and writes the resulting Slates.
- Pinning: slates and cache rows for samples are stored with `pinned = true` semantics (a nullable `expires_at` for sample slates, or a far-future expiry plus a `pinned` flag in the json; choose the lighter option and record it in ADR 0002 as an addendum line) so TTL cleanup and eviction never remove them. Stable ids: `sample-<slug>` shaped ids are allowed only for pinned samples and are served by the same `/s/[id]` hardened route (M2-04); ordinary ids still nanoid 21.
- One-click sample on the intake screen (built to `docs/design/screen-room-setup.md`): "Try a sample room" buttons (venue name and city) that open the stored slate instantly, with a line saying it is a recorded real Qloo run and its fetch date. Does not consume any budget (M2-05 cost 0 for pinned reads).
- Fixtures mode: the same sample rooms are served from `fixtures/qloo/` so they work with zero keys; a note says samples are recorded.
- Production: run the prewarm against production's database (`DATABASE_URL` and `QLOO_API_KEY` from the environment, never echoed) and verify the sample URLs respond.

## Out of scope

- Real-time refresh of samples; synthetic rooms; more than 3 rooms.
- Any change to scoring.

## Acceptance Criteria

- [ ] `rooms.json` validates against the room zod schema (test) and contains 2 or 3 rooms with only real, resolvable artist names.
- [ ] After prewarm, each sample slate loads from production in under 2 s (measured, recorded in `docs/evidence/m2-06-sample-latency.md` with 5 samples per room).
- [ ] Sample slates survive a simulated TTL cleanup (test deletes expired rows and asserts pinned rows remain).
- [ ] The intake screen shows one-click sample buttons that load a slate with zero Qloo calls (call counter 0).
- [ ] The prewarm script prints no key and no header (run with a canary key; grep output, expect 0).
- [ ] The ui-reviewer pass is recorded for the intake additions.

## Deliverables

- `apps/web/samples/rooms.json`, `scripts/prewarm-samples.ts`
- Pinned-slate handling in `packages/slates` and tests
- Sample buttons on the intake screen
- `docs/evidence/m2-06-sample-latency.md`

## Validation Gate

```bash
export DEMO_MODE=fixtures
npm ci && npm run lint && npm run typecheck
npx vitest run packages/slates apps/web scripts
npm run build
npm run start -- -p 3109 & PID=$!; sleep 6
for s in $(jq -r '.[].slug' apps/web/samples/rooms.json); do
  curl -s -o /dev/null -w "$s %{http_code} %{time_total}\n" "localhost:3109/s/sample-$s"
done
kill $PID
CANARY_KEY=canary-xyz-123 npx tsx scripts/prewarm-samples.ts --dry-run 2>&1 | grep -c canary-xyz-123   # expect 0
./scripts/check-no-secrets.sh
```

## Handoff

- M2-GATE uses the sample rooms to confirm the production run is fast.
- M3-04 may reuse the cached resolutions.
- M4-01 uses sample screenshots in the README.
