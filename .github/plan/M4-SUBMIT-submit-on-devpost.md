---
title: "M4-SUBMIT · Submit on Devpost"
milestone: "M4 · Submission"
labels: ["owner", "critical"]
blocked_by: ["M4-GATE"]
estimate: "1h"
resources: []
needs: [P-01, P-06, P-16]
---

## Context

Nothing earlier counts if the submission is missing or disqualified. Requirements (from the hackathon rules): a functional hosted demo free and unrestricted for judges, a public repo with an OSI licence visible in About, and a text description; video optional. The deadline is **2026-10-30 23:45 EDT (2026-10-31 09:15 IST)**. Target: submit the evening of 2026-10-30 IST, which leaves roughly twelve hours of margin against the deadline, and confirm the submission shows as submitted, not draft. Only the owner can perform the Devpost actions and the repo-visibility change; the agent prepares and verifies.

## Scope

1. **Repo public, with the owner's OK**: the owner states approval on the issue; then `gh repo edit --visibility public --accept-visibility-change-consequences` (owner-run or owner-authorised). The agent never changes visibility without that recorded OK.
2. **Licence in About**: `gh repo view --json licenseInfo` shows MIT; add repo description and topics (qloo, hackathon, nextjs, typescript) and the live URL as the homepage.
3. **Devpost form** (owner, console path: Devpost > hackathon page > Enter a Submission): project name and tagline; description pasted from `docs/devpost.md`; built-with list; try-it-out links (live URL, repo); testing instructions; gallery images from `docs/screenshots/`; video link if M4-02 produced one.
4. **Eligibility and ownership statements** confirmed by the owner on the form (original work, sole IP ownership, not funded by the sponsor, residency).
5. **Submit and confirm**: submit before the deadline; reload the Devpost project page while logged out (or in a private window) and confirm it renders, the demo link opens without login, and the repo is visible. Record the submission time and URL on the issue.
6. **Post-submit freeze checks**: production deploy and Neon database stay up through 2026-11-05 (finalist live demo for the top three); `DEMO_MODE=fixtures` fallback documented for after Qloo keys deactivate; owner notes the finalist slot time in IST when announced.

## Out of scope

- Editing code after the gate (a fix needs a new gate run); edits to Devpost text after submission are allowed until the deadline
- Promotion and social posts

## Acceptance Criteria

- [ ] Owner's approval to make the repo public recorded on the issue before the change
- [ ] `gh repo view --json visibility,licenseInfo` shows PUBLIC and MIT
- [ ] A logged-out fetch of the live URL returns 200 and of the repo URL returns 200
- [ ] Devpost shows the project as Submitted (not Draft), with the submission time recorded on the issue, earlier than 2026-10-30 23:45 EDT
- [ ] Devpost page text equals `docs/devpost.md` at the gated commit (owner confirms)
- [ ] The tested SHA from M4-GATE equals the SHA deployed to production

## Deliverables

- Issue comment: submission time (EDT and IST), Devpost project URL, repo URL, live URL, tested SHA
- Repo About filled in (description, topics, homepage)

## Validation Gate

```bash
set -euo pipefail
: "${REPO_SLUG:?owner/name}" "${DEMO_URL:?}" "${DEVPOST_URL:?}"
gh repo view "$REPO_SLUG" --json visibility,licenseInfo -q '.visibility+" "+.licenseInfo.key' | grep -qx 'PUBLIC mit'
[ "$(curl -s -o /dev/null -w '%{http_code}' "https://github.com/$REPO_SLUG")" = 200 ]
[ "$(curl -s -o /dev/null -w '%{http_code}' "$DEMO_URL")" = 200 ]
[ "$(curl -s -o /dev/null -w '%{http_code}' "$DEVPOST_URL")" = 200 ]
# deadline margin: now must be before 2026-10-31T03:45:00Z (= 23:45 EDT on Oct 30)
[ "$(date -u +%s)" -lt "$(date -u -d '2026-10-31T03:45:00Z' +%s)" ] && echo "before deadline: $(date -u)"
```

## Handoff

End of the plan. After submission only monitoring remains: the uptime check from M3-05 and the owner's watch on Devpost and Discord until finalists are announced.
