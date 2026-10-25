---
title: "M4-02 · Devpost text and optional short video"
milestone: "M4 · Submission"
labels: ["docs", "owner"]
blocked_by: ["M3-GATE"]
estimate: "2h"
resources: []
needs: [P-17]
---

## Context

Stage 1 is pass/fail on theme fit and use of the required API; then four equal-weight criteria are judged from the Devpost page, the demo and the repo. The text must describe exactly what is built, no more. A video is not required by the rules, so it is optional, but the demo storyboard from `PROJECT.md` section 2 is already under three minutes and gives the finalists (top three appear live on 2026-11-05) a rehearsed path. Video content must never show a key.

## Scope

1. Draft the Devpost text in `docs/devpost.md` (tracked, public-safe): project name, tagline, "Inspiration", "What it does", "How we built it" (Qloo REST adapter, endpoints used: search, insights, compare, heatmap; fixtures; LLM at the edges), "Challenges", "Accomplishments" (measured numbers with their sample, linked to `docs/evidence/`), "What we learned", "What's next", built-with list, and a **Testing instructions** block: live URL, the sample-room one-click path, no login or CAPTCHA needed, the `DEMO_MODE=fixtures` repo path, demo limits note.
2. Alignment check: a table in `docs/devpost.md` is not needed; do it on the ticket issue. Compare each claim sentence of the draft against `PROJECT.md` section 2 and 9, `README.md` and the running app. Every claim maps to a feature that exists on production or a file in `docs/evidence/`; anything that does not exist is removed from the text. The same banned-wording rule as the README applies.
3. Optional video (owner-recorded, under 3 minutes) following the storyboard: empty-room pain, real venue and five acts, confirm matches, slate, compare with Qloo popularity-rank order, open the top act and evidence, nearby cities with thin-data flag, an act with no data, close on Lagos, Berlin, Jakarta. A shot list and narration script go in `docs/demo-script.md` whether or not the owner records. Recording checklist: browser devtools, terminal and `.env` closed; no network-tab view of request headers; no key anywhere on screen; captions or an on-screen text version for accessibility.
4. Image set for the Devpost gallery from `docs/screenshots/` (reused from M4-01).

## Out of scope

- The submit action itself (M4-SUBMIT)
- README (M4-01) and the security pass (M4-03)
- Recording the video on the owner's behalf: the owner records and uploads; the agent supplies script, shot list and checks

## Acceptance Criteria

- [ ] `docs/devpost.md` contains every section above, including Testing instructions with the live URL and the zero-key repo path
- [ ] Alignment check posted on the issue: each claim in the text mapped to a live feature or evidence file; zero unmatched claims
- [ ] No occurrence of "forecast", "turnout" or "will sell" except in the banner wording or a negation
- [ ] Every number in the text matches the number in `docs/evidence/` (script below)
- [ ] `docs/demo-script.md` has a timed shot list totalling under 180 seconds
- [ ] If a video exists: the owner confirms on the issue that no key, `.env`, or header value is visible, and the link is recorded on the issue (not in the repo)
- [ ] The live URL in the text returns 200 and the sample-room path works without login

## Deliverables

- `docs/devpost.md`
- `docs/demo-script.md`
- Alignment check comment on the issue; video link on the issue if recorded

## Validation Gate

```bash
set -euo pipefail
test -s docs/devpost.md && test -s docs/demo-script.md
grep -q 'Testing instructions' docs/devpost.md
grep -nEi 'will sell|turnout|forecast' docs/devpost.md || true     # review hits by hand
URL=$(grep -oE 'https://[A-Za-z0-9./_-]+' docs/devpost.md | head -1)
[ "$(curl -s -o /dev/null -w '%{http_code}' "$URL")" = 200 ]
# every percentage or ratio quoted in the text appears in an evidence file
grep -oE '[0-9]+(\.[0-9]+)?%|[0-9]+ of [0-9]+' docs/devpost.md | sort -u | while read -r n; do
  grep -rqF "$n" docs/evidence/ || { echo "number not in evidence: $n"; exit 1; }
done
./scripts/check-no-secrets.sh
```

## Handoff

M4-SUBMIT pastes `docs/devpost.md` into Devpost and uses the testing instructions and gallery images. M4-GATE checks the Devpost checklist against this file. M4-CLEANUP must keep `docs/devpost.md` and `docs/demo-script.md` tracked, or the owner decides to keep them private and the citations are repointed.
