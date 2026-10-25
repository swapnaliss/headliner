---
title: "M4-GATE · M4 gate: public tree proven from a clean clone"
milestone: "M4 · Submission"
labels: ["gate"]
blocked_by: ["M4-CLEANUP", "M4-01", "M4-02", "M4-03"]
estimate: "1h"
resources: []
needs: [P-10]
---

## Context

The last gate before the owner submits. It runs after M4-CLEANUP, so it proves exactly what judges will see: the public tree, cloned fresh, with no internal workflow files, no keys, no database and no LLM. It also checks the live demo, the visible licence, the README links and the Devpost checklist. A failure here blocks M4-SUBMIT; the fix is a new commit, never a history rewrite.

## Scope

All checks run against a **fresh clone of the merge commit on the default branch**, not the working tree, and never rely on a file the cleanup untracked (`PROJECT.md`, `WORKFLOW.md`, `CLAUDE.md`, `.github/plan/`, `docs/engineering-standards.md`, `docs/budget.md`, `docs/PREREQS.md`, `.claude/commands/`, `.claude/agents/`).

1. **Public tree**: none of the M4-CLEANUP internal paths exist in the clone; every repo path cited in a tracked file exists in the clone.
2. **Tests**: `npm ci` then the full test suite and `./scripts/landing-checks.sh` with no `.env` present.
3. **Zero-key run**: with a scrubbed environment (`env -i`), `DEMO_MODE=fixtures` starts the app and `POST` of a fixtures room returns a Slate with Evidence and the banner text present on the rendered page; no database or LLM contacted.
4. **Live demo check**: the production URL returns 200 with the banner; the pre-warmed sample room completes without login or CAPTCHA within the latency target; a shared slate link opens with noindex; the uptime check from M3-05 is green. This is the only step using the network.
5. **Licence visible**: `LICENSE` is MIT in the clone, the GitHub repo About shows the licence (`gh repo view --json licenseInfo`).
6. **README links**: every relative link and image in `README.md` resolves in the clone; external links return a non-error status.
7. **Secrets**: gitleaks over the clone's full history, `./scripts/check-no-secrets.sh`.
8. **Devpost checklist** (items verified from the clone and the issue): `docs/devpost.md` present with testing instructions; live URL in it equals the production URL; claims match the README; video link (if any) recorded on the M4-02 issue; repo public only with the owner's OK recorded on the M4-SUBMIT issue.
9. **CI** is green on the merge commit; BL-01 has no entry left `open` without a recorded reason.

## Out of scope

- Fixing failures (open a fix commit on the owning ticket, then re-run)
- Making the repo public and submitting (M4-SUBMIT)

## Acceptance Criteria

- [ ] Every validation command below exits 0 from a clean clone, output posted on the issue
- [ ] The zero-key run returns a Slate with Evidence and the banner in the page
- [ ] `gh repo view` reports MIT as the licence
- [ ] README link check prints nothing
- [ ] Live demo check passes without login or CAPTCHA
- [ ] Gitleaks full-history scan has zero findings
- [ ] Devpost checklist ticked on the issue; every milestone ticket of M4 closed

## Deliverables

- Gate report comment on the issue with the commit SHA tested, command outputs and the checklist
- A fix commit and re-run for any failure

## Validation Gate

```bash
set -euo pipefail
: "${DEMO_URL:?production URL}" "${REPO_URL:?repo clone URL or local path}"
tmp=$(mktemp -d "$TMPDIR/m4gate.XXXX"); git clone -q "$REPO_URL" "$tmp/c"; cd "$tmp/c"; git log -1 --format='testing %H'
# 1 public tree
INTERNAL='^(\.github/plan/|PROJECT\.md$|WORKFLOW\.md$|CLAUDE\.md$|\.claude/(commands|agents)/|scripts/(waves|bootstrap_github|check-prereqs|check-plan)\.py$|docs/(engineering-standards|PREREQS|budget)\.md$)'
! git ls-files | grep -E "$INTERNAL"
missing=$(git grep -hoE '(docs|scripts|infra|fixtures|\.github)/[A-Za-z0-9_./-]+\.(md|ts|tsx|js|mjs|json|ya?ml|sh|py)' | sort -u | while read -r p; do [ -e "$p" ] || echo "$p"; done)
[ -z "$missing" ] || { echo "MISSING: $missing"; exit 1; }
# 2 tests, no .env
test ! -e .env
npm ci && npm test && ./scripts/landing-checks.sh
# 3 zero-key run
env -i PATH="$PATH" HOME="$tmp" DEMO_MODE=fixtures npm run build
(env -i PATH="$PATH" HOME="$tmp" DEMO_MODE=fixtures PORT=3977 npm start >"$tmp/app.log" 2>&1 & echo $! >"$tmp/pid")
for i in $(seq 1 30); do curl -sf localhost:3977 >/dev/null && break; sleep 1; done
curl -s localhost:3977 | grep -qi 'aggregate affinity, not a ticket forecast'
kill "$(cat "$tmp/pid")"
# 4 live demo
[ "$(curl -s -o /dev/null -w '%{http_code}' "$DEMO_URL")" = 200 ]
curl -s "$DEMO_URL" | grep -qi 'aggregate affinity, not a ticket forecast'
# 5 licence
grep -q 'MIT License' LICENSE
gh repo view "${REPO_SLUG:?owner/name}" --json licenseInfo -q .licenseInfo.key | grep -qx mit
# 6 README links
grep -oE '\]\((\.?/?[A-Za-z0-9_./-]+\.(md|png|json|sh|ts))\)' README.md | sed -E 's/.*\]\((.*)\)/\1/' | sort -u | while read -r p; do [ -e "$p" ] || { echo "broken: $p"; exit 1; }; done
# 7 secrets
gitleaks detect --source . --log-opts="--all" --redact --no-banner
./scripts/check-no-secrets.sh
# 8 Devpost
grep -q 'Testing instructions' docs/devpost.md && grep -qF "$DEMO_URL" docs/devpost.md
```

## Handoff

M4-SUBMIT starts only after this gate passes; it needs the tested commit SHA, the production URL and the ticked Devpost checklist from the gate comment.
