---
title: "M0-04 · Harness-as-library check and organiser questions"
milestone: "M0 · Recon & Bootstrap"
labels: ["recon", "owner"]
blocked_by: []
estimate: "1.5h"
resources: []
needs: [P-02]
---

## Context

The Stage 1 rule asks that the project applies the required APIs. The kit lists harness surfaces as supported, and ADR 0012 chose a REST adapter because a serverless Next.js app cannot reliably spawn a CLI. Whether `@qloo/qloo-harness` can be imported and called programmatically decides if that adapter could sit behind the harness later, and the answer plus the organiser's reply shape the honest "REST vs harness" paragraph in the README. Open organiser questions (`PROJECT.md` section 1) are fixture redistribution, quota and the finalist slot time in IST.

## Scope

1. **Library check** in a throwaway directory under `$TMPDIR` (not inside the repo): install `@qloo/qloo-harness@0.1.26` (kit minimum), read its `package.json` (`main`, `exports`, `bin`, `types`), try `import` and `require`, list exported symbols, and attempt one programmatic call (for example a `find_tags` or search-equivalent workflow) using the key from the `QLOO_API_KEY` environment variable without printing it. Record what happens: importable or CLI only, needed environment, Node version needs, whether it works in a serverless runtime (no child process), response shape versus the REST fixtures from M0-02 where available.
2. Write `docs/evidence/harness-check.md`: the commands run, outputs (with any secret removed), version, verdict ("importable and equivalent", "importable but different", or "CLI only"), and the consequence for ADR 0012 (switch behind the same adapter interface, or stay on REST).
3. **Draft organiser posts** in `docs/outreach/discord-api-help.md` and `docs/outreach/devpost-forum.md`, each self-contained and short, covering: (a) is a REST adapter against `hackathon.api.qloo.com` an acceptable "supported surface" alongside the harness; (b) may recorded Qloo responses be committed to the public repo as test fixtures (and under what attribution); (c) the request quota and rate limit for the hackathon key; (d) the live finalist slot time in IST for 2026-11-05. The drafts contain no key, no private data, and state only the project's public purpose.
4. Add an `## Owner action` checklist at the top of each draft file: where to post (Discord #api-help, Devpost forum), the exact text to paste, and a place to paste the reply link. Posting is done by the owner, not by an agent.
5. If the harness is importable, add a short note to `docs/adr/0012-qloo-access-via-rest.md` under a new "Update" heading with the evidence link, without changing its Accepted status or decision.

## Out of scope

- Posting to Discord or Devpost (owner only).
- Replacing the REST adapter (M1-01 implements the adapter either way).
- Committing the harness as a runtime dependency of the app.

## Acceptance Criteria

- [ ] `docs/evidence/harness-check.md` states the verdict, shows the import attempt and the exports, and names the ADR 0012 consequence
- [ ] The harness was installed only in a `$TMPDIR` directory; `git status` shows no `node_modules` or lockfile change from it
- [ ] Both outreach drafts exist, each covers all four questions, and contain no key, header value or personal data
- [ ] Each draft starts with an owner checklist saying where to post and what to record
- [ ] The evidence and drafts pass the secret scan

## Deliverables

- `docs/evidence/harness-check.md`
- `docs/outreach/discord-api-help.md`, `docs/outreach/devpost-forum.md`
- optional "Update" section in `docs/adr/0012-qloo-access-via-rest.md`

## Validation Gate

```bash
set -euo pipefail
test -s docs/evidence/harness-check.md
grep -Eqi 'importable|CLI only' docs/evidence/harness-check.md
for f in docs/outreach/discord-api-help.md docs/outreach/devpost-forum.md; do
  test -s "$f"
  grep -qi 'owner' "$f"
  for q in 'supported' 'fixture' 'quota' 'IST'; do grep -qi "$q" "$f" || { echo "$f missing $q"; exit 1; }; done
done
if [ -n "${QLOO_API_KEY:-}" ]; then ! grep -rqF -- "$QLOO_API_KEY" docs; fi
! grep -rqi 'x-api-key:' docs/evidence docs/outreach
test -z "$(git status --porcelain -- package.json package-lock.json | grep -v '^$' || true)" || echo "note: lockfile changes belong to other tickets"
./scripts/check-no-secrets.sh
```

## Handoff

- The owner posts both drafts and records the reply links in the files; M4-01 uses the replies for the README "approach" and limits sections, and M4-02 uses the IST slot time.
- M1-01 follows the verdict for the adapter interface.
- M0-GATE checks the evidence and the drafts exist and flags unposted drafts to the owner.
