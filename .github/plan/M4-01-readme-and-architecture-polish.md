---
title: "M4-01 · README for judges and architecture polish"
milestone: "M4 · Submission"
labels: ["docs"]
blocked_by: ["M3-GATE"]
estimate: "3h"
resources: []
needs: []
---

## Context

The README is the first thing every judge reads and the main carrier of the Potential Impact and Quality of the Idea criteria; the architecture document carries Technological Implementation. Two hackathon-specific risks are handled here by stating them plainly: the REST-versus-harness approach (ADR 0012, a Stage 1 reading risk) and what the flat `/v2/trending` data does not support. Claims discipline applies: no sentence in the README without a measured or checkable source in the repo. A limitation found and stated is a strength; the same limitation found by a judge is a hole, so this ticket also triages the BL-01 backlog into the honest-limits section.

## Scope

1. `README.md` with these sections, in this order:
   - **Problem**: the named buyer (independent venue talent buyers, promoters, festival bookers, artist managers) and the instinct-based booking pain, marked as inference where it is.
   - **Solution**: audience-taste fit, evidence trail, audience standing (labelled "Qloo popularity rank"), lazy city strength, shareable slate. Use the banner wording "aggregate affinity, not a ticket forecast"; never "forecast", "turnout" or "will sell" as a claim.
   - **Why now**: why an agent with Qloo taste data fits this decision.
   - **Architecture**: the diagram from `docs/architecture.md` section 4 plus a short pipeline description (resolve, compare, score, lazy heatmap; LLM only at intake and explanation edges, ADR 0009), linking each ADR 0001 to 0013 used.
   - **Demo**: live URL, the pre-warmed sample rooms, and screenshots committed under `docs/screenshots/` (room setup, match confirmation, slate, act detail with evidence panel, thin-data flag, empty state), each with alt text.
   - **How to run**: `DEMO_MODE=fixtures` path with zero keys, no database, no LLM (exact commands copied from a clean-clone run), then the live-mode path naming env var names from `.env.example` (names only, no values), and how to run tests and `./scripts/landing-checks.sh`.
   - **Measured results**: the home-city check and the Fit sanity test from `docs/evidence/` (M3-04), each with its listed sample and no preset target; the latency and call-count table from `docs/evidence/qloo-latency.md` (M0-02); the agent eval results (M3-03). Every number links to its evidence file.
   - **Honest limits**: the approach statement (a REST adapter over `hackathon.api.qloo.com`, ADR 0012, with the result of the M0-04 harness-as-library check and the status of the organiser question); `/v2/trending` is flat in this environment so there are no momentum claims and standing is a Qloo popularity rank; heatmap affinity is rescaled per city so cities are compared by mean `affinity_rank` plus cell count, and fewer than 15 cells is thin data; no ticket-sale or turnout forecast; no individual inference; fixture redistribution status; Qloo keys deactivate after judging so the hosted demo's live mode ends and `DEMO_MODE=fixtures` remains; limits 12 candidate acts, 6 crowd acts, 5 cities, name length 80; per-IP demo limits.
   - **Future vision**: from `PROJECT.md` section 11 (season-long programming, multi-venue circuits, artist and agent view for tour cities, other live categories).
   - **Licence**: MIT, link to `LICENSE`.
2. BL-01 triage: read every comment on the BL-01 issue (`gh issue view` for the number in `.github/plan/issue-map.json`). For each entry whose `**Status:**` is `open`, decide by its `**Action:**` line: `fix before submission` is fixed here or in its owner ticket and the Status line edited in place; `accept as limitation` becomes a line in Honest limits and its Status becomes `accepted limitation (<reason>)`; `document in HLD` goes into `docs/architecture.md`. No entry is deleted.
3. Architecture polish: bring `docs/architecture.md` in line with what was built (fill the Fit row with the final ADR 0013 summary, replace "assumed" requirement statuses with measured values where `docs/evidence/` has them, update the call-count figures), and add the closing one-line check per principle if missing.
4. Link check: every relative link in `README.md` and `docs/architecture.md` resolves to a tracked file; every screenshot exists. Files cited must survive M4-CLEANUP, so cite only paths on its keep-tracked list (do not link `PROJECT.md`, `WORKFLOW.md`, `CLAUDE.md`, `docs/engineering-standards.md`, `docs/budget.md` or `docs/PREREQS.md`).
5. Claims audit: a table in the PR description mapping each quantitative or capability claim in the README to its evidence file or test.

## Out of scope

- Devpost text and video (M4-02)
- Security checks (M4-03)
- Untracking workflow files (M4-CLEANUP)
- New product features; a defect found while writing goes to BL-01 with an owner ticket

## Acceptance Criteria

- [ ] README contains every section above in order, with the exact headings Problem, Solution, Why now, Architecture, Demo, How to run, Measured results, Honest limits, Future vision
- [ ] The `DEMO_MODE=fixtures` commands in the README, executed verbatim from a clean clone with no `.env`, start the app and render a slate
- [ ] Every number in Measured results links to a file in `docs/evidence/` that states its sample
- [ ] Honest limits states the REST-versus-harness approach and that trending data supports no momentum claim
- [ ] No occurrence of "forecast", "turnout" or "will sell" in the README except inside the banner wording or a negation
- [ ] Every BL-01 entry has a Status other than `open`, or is justified as still open on the issue
- [ ] All relative links and screenshots resolve; no secret value, key name value, or `X-Api-Key` header value appears in README or screenshots
- [ ] `docs/architecture.md` has no remaining "defined by M0-03" or "assumed, measured in" placeholder where evidence exists

## Deliverables

- `README.md`
- `docs/architecture.md` (updated)
- `docs/screenshots/*.png`
- BL-01 comments with updated Status lines

## Validation Gate

```bash
set -euo pipefail
for h in Problem Solution "Why now" Architecture Demo "How to run" "Measured results" "Honest limits" "Future vision"; do
  grep -qE "^## $h" README.md || { echo "missing heading: $h"; exit 1; }
done
# banned claim wording (allowed only in the banner or a negation; review any hit by hand)
grep -nEi 'will sell|turnout|forecast' README.md || true
# relative links resolve
grep -oE '\]\((\.?/?[A-Za-z0-9_./-]+\.(md|png|json|sh|ts))\)' README.md docs/architecture.md \
  | sed -E 's/.*\]\((.*)\)/\1/' | sort -u | while read -r p; do
  [ -e "$p" ] || [ -e "docs/$p" ] || { echo "broken link: $p"; exit 1; }
done
# README run path from a clean state
tmp=$(mktemp -d "$TMPDIR/m401.XXXX") && git clone -q . "$tmp/c"
(cd "$tmp/c" && env -i PATH="$PATH" HOME="$tmp" DEMO_MODE=fixtures npm ci && DEMO_MODE=fixtures npm test)
./scripts/check-no-secrets.sh
```

## Handoff

M4-02 reuses the README text and screenshots for the Devpost description and the alignment check. M4-CLEANUP needs every file cited by README and `docs/architecture.md` to be on its keep-tracked list. M4-GATE runs the README commands from a clean clone and checks its links.
