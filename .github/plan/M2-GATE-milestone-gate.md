---
title: "M2-GATE · M2 gate: the demo storyboard runs for real end to end on production"
milestone: "M2 · Core Loop"
labels: ["gate"]
blocked_by: ["M2-01", "M2-02", "M2-03", "M2-04", "M2-05", "M2-06"]
estimate: "1h"
resources: []
needs: []
---

## Context

M2 delivers the core loop. The gate proves it on production, not locally, by walking the demo storyboard in `PROJECT.md` section 2 up to the agent layer (M3). Judges only see production, so a green local build is not enough.

## Scope

Walk each storyboard step on the production URL with the live stack and record results in `docs/evidence/m2-gate.md` (steps, observed result, request summaries, no keys):

1. Intake screen loads; banner "aggregate affinity, not a ticket forecast" is visible; demo-limits note present.
2. A real venue and five acts (typed): match confirmation appears for an ambiguous name and blocks ranking until confirmed.
3. Slate appears with ranked cards (Fit, shared tastes, audience standing labelled "Qloo popularity rank", caveats).
4. Compare with the Qloo popularity-rank order: the order differs (record both orders).
5. Open the top act: shared tastes and the redacted evidence trail (no headers).
6. Nearby-city strip loads lazily, with a thin-data flag on a thin city.
7. An act with no data shows the honest empty state.
8. Copy the share link; open it in a clean session: noindex, CSP present, plain text.
9. Sample rooms load in under 2 s.
10. Abuse protection: the per-IP limit returns a clean 429 message; a fresh IP is not blocked; the global ceiling path serves cached or deterministic output.
11. Run `DEMO_MODE=fixtures` from a clean clone with zero keys and confirm steps 1 to 3, 5 and 8 work.

Also: all M2 tickets merged, CI green, ui-reviewer passes recorded, a timed first-run by someone unfamiliar or a stopwatch run of the core journey (record the time honestly).

## Out of scope

- Agent intake and explanation (M3), observability (M3-05), final polish.
- Fixing defects found: file them via `/backlog` with an owner ticket, then fix in the owning ticket before closing the gate.

## Acceptance Criteria

- [ ] Every storyboard step 1 to 11 above has a recorded pass in `docs/evidence/m2-gate.md` with the production URL and date.
- [ ] No step fails; any defect found is fixed and re-walked before the gate closes.
- [ ] The core journey time on production is recorded (measured, sample of at least 3 runs).
- [ ] `python3 scripts/check-prereqs.py` reports no missing required item.
- [ ] No secret in repo, logs or the evidence file.

## Deliverables

- `docs/evidence/m2-gate.md`
- Gate status comment on the issue

## Validation Gate

```bash
export PROD_URL="${PROD_URL:?production URL}"
curl -s -o /dev/null -w '%{http_code}\n' "$PROD_URL"                      # expect 200
curl -s "$PROD_URL" | grep -c 'aggregate affinity, not a ticket forecast'   # expect >= 1
for s in $(jq -r '.[].slug' apps/web/samples/rooms.json); do
  curl -s -o /dev/null -w "$s %{http_code} %{time_total}\n" "$PROD_URL/s/sample-$s"
done
curl -sI "$PROD_URL/s/not-a-real-id" | head -1                             # expect 404
curl -sI "$PROD_URL/s/sample-$(jq -r '.[0].slug' apps/web/samples/rooms.json)" | grep -iE 'x-robots-tag|content-security-policy'
D=$(mktemp -d "$TMPDIR/m2gate.XXXX") && git clone -q . "$D/c" && cd "$D/c" \
  && DEMO_MODE=fixtures npm ci && DEMO_MODE=fixtures npm test && DEMO_MODE=fixtures npm run build
python3 scripts/check-prereqs.py
./scripts/check-no-secrets.sh
python3 scripts/waves.py 3
```

## Handoff

- Unblocks M3 (M3-01 through M3-06), all `blocked_by: ["M2-GATE"]`.
- M3-01 needs the confirmation flow and budgets; M3-02 needs the Slate and act detail fields; M3-04 needs `cityStrength`; M3-05 needs the production URL.
