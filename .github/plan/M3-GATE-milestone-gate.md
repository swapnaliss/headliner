---
title: "M3-GATE · M3 gate"
milestone: "M3 · Agent Layer & Proof"
labels: ["gate"]
blocked_by: ["M3-01", "M3-02", "M3-03", "M3-04", "M3-05", "M3-06"]
estimate: "1h"
resources: []
needs: []
---

## Context

M3 adds the agent edges and the proof. This gate confirms the intake loop and grounded explanation work under caps and fall back to deterministic mode, the evals run offline in CI, the measured results exist with their samples listed, the service is observable, and every screen is complete and accessible, before the submission milestone begins. Judges see the rubric criteria Technological Implementation, Design and Potential Impact here.

## Scope

- Re-run every M3 ticket's Validation Gate from a clean checkout.
- Run `python3 scripts/check-prereqs.py` and confirm the M3 resources (LLM, QLOO, DEPLOY) are satisfied or the zero-key fallback passes.
- Confirm the live demo on production: one sentence intake produces a Room, the slate renders with the explanation (source label visible), `/api/health` is green, and the uptime monitor shows up.
- Confirm results in `docs/evidence/` match what the UI and PROJECT.md claim: wording audit for "forecast", "turnout", "will sell", and momentum claims returns nothing in the UI or docs.
- Confirm total LLM spend to date against the budget in `docs/budget.md`.
- Log any defect found as a backlog entry via `.claude/commands/backlog.md` with an `**Owner ticket:**` line; fix blockers in place.

## Out of scope

- New features or scope changes.
- README and Devpost writing (M4).

## Acceptance Criteria

- [ ] `env -u ANTHROPIC_API_KEY -u QLOO_API_KEY DEMO_MODE=fixtures` full run: lint, typecheck, tests, `npm run eval:agent`, `npm run proof`, a11y suite all exit 0.
- [ ] CI is green on the default branch with the eval job required.
- [ ] Production slate run completes end to end with the intake sentence and shows the explanation; the deterministic fallback is demonstrated by running with the LLM budget forced to zero.
- [ ] `docs/evidence/{home-city-check.md,fit-sanity.md,agent-evals.md,ui-review-m3.md}` exist and are non-empty.
- [ ] Monitor and `/api/health` verified on the production URL.
- [ ] No key, header or raw upstream error in the repo, fixtures, logs or screenshots.
- [ ] LLM spend within the approved ceiling.

## Deliverables

- A gate comment on the issue listing each check, its command and result
- Backlog entries for any residual defects, each with `**Owner ticket:**` and `**Status:**`

## Validation Gate

```bash
env -u ANTHROPIC_API_KEY -u QLOO_API_KEY DEMO_MODE=fixtures bash -c '
  npm ci && npm run lint && npm run typecheck && npm test &&
  npm run eval:agent && npm run proof &&
  npx playwright test apps/web/tests/a11y apps/web/tests/keyboard --reporter=line'
python3 scripts/check-prereqs.py; echo "prereqs exit $?"
curl -fsS "${DEMO_URL:?set to the deployed URL}/api/health" | jq -e '.ok==true'
for f in home-city-check fit-sanity agent-evals ui-review-m3; do test -s docs/evidence/$f.md || echo "missing $f"; done
! grep -rniE 'forecast|turnout|will sell' apps/web/app docs/evidence | grep -viE 'not a ticket forecast|never'
./scripts/check-no-secrets.sh
```

## Handoff

- M4-01, M4-02 and M4-03 are unblocked by this gate; they consume the evidence files, screenshots and the injection corpus.
