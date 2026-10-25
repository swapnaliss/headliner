---
title: "M0-GATE · M0 gate"
milestone: "M0 · Recon & Bootstrap"
labels: ["gate"]
blocked_by: ["M0-00", "M0-01", "M0-02", "M0-03", "M0-04", "M0-05"]
estimate: "1h"
resources: []
needs: [P-02, P-04, P-08, P-18]
---

## Context

M0 exists to remove the risks that could sink the build: an unknown Qloo shape and quota, an undecided Fit formula, a delivery chain that does not deploy, and missing owner prerequisites. This gate proves, from a clean state and without the owner, that every M0 deliverable exists and works, so M1 can start on recorded facts. It is the owner's checkpoint for ADR 0013.

## Scope

Run the Validation Gate below from a clean clone and attach its output to the gate issue. Specifically it proves that:

1. All prerequisites are accounted for: `python3 scripts/check-prereqs.py` (per the M0-00 handoff, this is part of this gate). Required items still missing are reported by name to the owner; the gate does not pass while a required item is missing.
2. The hello deploy responds in production (M0-01).
3. Qloo fixtures exist for search, insights, compare, heatmap and trending, with the latency evidence file (M0-02).
4. ADR 0013 is Accepted and the scoring tests pass (M0-03).
5. The harness check and both organiser drafts exist; unposted drafts are listed for the owner (M0-04).
6. The Postgres cache test passes and the migration is in sync (M0-05).
7. CI is green on the default branch, the secret scan is clean and the licence is MIT.
8. `./scripts/check-no-secrets.sh` passes.

Also: summarise the measured findings that change later tickets (list-compare result, p95 latency, quota and 429 observations, Fit sanity result, harness verdict) in a gate comment, so M1 tickets can be adjusted through the backlog, not by changing scope.

## Out of scope

- Fixing failures (a failing check reopens its ticket).
- Any M1 work.

## Acceptance Criteria

- [ ] `python3 scripts/check-prereqs.py` exits 0 (no required prerequisite missing) and prints no secret
- [ ] The production hello deploy answers `GET /api/health` with `ok: true`
- [ ] Fixtures exist for all five Qloo endpoints and `docs/evidence/qloo-latency.md` exists
- [ ] `docs/adr/0013-fit-formula.md` has `Status: Accepted`
- [ ] The cache test passes and `npm run check` passes from a clean clone
- [ ] `docs/evidence/harness-check.md` and both `docs/outreach/` drafts exist; unposted drafts are listed to the owner
- [ ] CI is green on the default branch; gitleaks and the licence check pass
- [ ] The gate comment lists measured findings and the owner checklist (post the outreach drafts, approve ADR 0013)

## Deliverables

- Gate issue comment with the command output and findings summary
- `docs/evidence/m0-gate.md` (output of the Validation Gate, no secrets)

## Validation Gate

```bash
set -euo pipefail
T="$(mktemp -d "${TMPDIR:-/tmp}/m0-gate.XXXXXX")"
# 1. prerequisites (required items must be present; output is names and status only)
python3 scripts/check-prereqs.py | tee "$T/prereqs.txt"
if [ -n "${QLOO_API_KEY:-}" ]; then ! grep -qF -- "$QLOO_API_KEY" "$T/prereqs.txt"; fi
# clean clone, zero-key checks
git clone --quiet . "$T/clone" && cd "$T/clone"
env -i PATH="$PATH" HOME="$HOME" bash -c 'npm ci --no-audit --no-fund && npm run check'
# 2. hello deploy responds
URL="${HEADLINER_PROD_URL:?set HEADLINER_PROD_URL}"
curl -fsS "$URL/api/health" | jq -e '.ok == true'
curl -fsS "$URL/" | grep -q 'aggregate affinity, not a ticket forecast'
# 3. fixtures exist
for e in search insights compare heatmap trending; do ls fixtures/qloo | grep -q "^$e--" || { echo "missing $e fixture"; exit 1; }; done
jq -e 'length > 0' fixtures/qloo/index.json
test -s docs/evidence/qloo-latency.md
# 4. ADR 0013 Accepted and scoring tests pass
grep -q '^Status: Accepted' docs/adr/0013-fit-formula.md
env -i PATH="$PATH" HOME="$HOME" npm test --silent -- packages/core
# 5. harness check and outreach drafts
test -s docs/evidence/harness-check.md
test -s docs/outreach/discord-api-help.md && test -s docs/outreach/devpost-forum.md
# 6. cache test passes (ephemeral Postgres, no secrets) and migration in sync
env -i PATH="$PATH" HOME="$HOME" npm test --silent -- packages/slates
npm run db:generate --silent && test -z "$(git status --porcelain packages/slates/drizzle)"
# 7. licence, secrets
grep -q '"license": "MIT"' package.json
./scripts/check-no-secrets.sh
gh run list --branch "$(git -C . rev-parse --abbrev-ref HEAD)" --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success || echo "WARN: check CI on the default branch"
cd - >/dev/null
echo "M0 GATE PASS"
```

## Handoff

- Every M1 ticket is blocked by this gate; M1-01 consumes the fixtures, latency and quota evidence; M1-02 consumes ADR 0013; M1-04 starts from the design docs directory.
- The owner is asked to: post the outreach drafts, approve ADR 0013, and confirm any prerequisite still reported missing.
