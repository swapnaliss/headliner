---
title: "M4-03 · Security pass"
milestone: "M4 · Submission"
labels: ["security"]
blocked_by: ["M3-GATE"]
estimate: "1.5h"
resources: []
needs: [P-10]
---

## Context

The repo goes public and the demo is open to anonymous judges. A key in history, a screenshot or a log, or a raw upstream error reaching the client, is disqualifying or embarrassing (ADR 0008, rules: hackathon key only against `hackathon.api.qloo.com`, never in client code, repo, logs, screenshots or recordings). This ticket proves each claim on the final code, so the Technological Implementation story about security is verified rather than asserted.

## Scope

1. **Secret scan over full history**: `gitleaks detect` over all commits and branches, plus `./scripts/check-no-secrets.sh`. The owner additionally checks that the local key literal occurs zero times in history (owner-run, prints only a count, never the value); agents never read the key file.
2. **Header redaction check**: a Vitest test (`tests/security/redaction.test.ts`) runs the Qloo adapter against a fixture-backed fake and asserts that no Evidence, log line or cache row contains `X-Api-Key`, the key value, or any header; Evidence holds only endpoint and redacted params.
3. **CSP and headers**: on the production URL and locally, assert `Content-Security-Policy` (no `unsafe-eval`, no third-party script origins), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options` or `frame-ancestors`, and `X-Robots-Tag: noindex` / robots meta on shared slate pages (`/s/<id>` or the implemented route).
4. **Dependency audit**: `npm audit --omit=dev` and a lockfile check; each high or critical finding is fixed or recorded in BL-01 with a reason; no unpinned `latest`.
5. **No key in client bundle, logs or screenshots**: grep `.next` build output for the key pattern and for `hackathon.api.qloo.com` (host may appear only in server chunks); inspect `docs/screenshots/` (including EXIF/metadata via `exiftool` if present) and the dev-tools-free capture rule; grep the app's JSON log output from a fixtures run.
6. **Raw upstream errors**: tests force the adapter to receive 429, 500, a timeout, malformed JSON and a 200 with the wrong shape; the HTTP response body to the client contains only the typed error code and a generic message, never upstream text, URL, or stack.
7. **Injection and abuse spot checks** (not a new feature): entity names containing `&filter.type=`, `<script>`, and 10k characters are rejected or rendered as plain text; the per-IP budget returns the deterministic-mode response rather than an error page; input caps 12 candidates, 6 crowd acts, 5 cities, name length 80 are enforced server-side.
8. Record results in `docs/evidence/security-pass.md` (commands, counts, dates; no secret values).

## Out of scope

- New security features; a gap that needs one is logged to BL-01 with its owner ticket, and fixed if it breaks a disqualifying rule
- Untracking workflow files (M4-CLEANUP)

## Acceptance Criteria

- [ ] gitleaks over full history reports zero findings
- [ ] The owner confirms on the issue that the key-literal history count is `0` (no key material in the comment)
- [ ] Redaction test passes and fails if a header is added to Evidence (mutation shown once on the issue)
- [ ] Production responses carry the header set in Scope 3; shared pages are noindex
- [ ] `npm audit --omit=dev` shows no unaddressed high or critical issue
- [ ] Build output and screenshots contain no key; log output from a fixtures run contains no header names
- [ ] Each forced upstream failure returns a sanitized client body (test proves it)
- [ ] `docs/evidence/security-pass.md` exists with results and no secret value

## Deliverables

- `tests/security/redaction.test.ts`, `tests/security/upstream-errors.test.ts`
- `docs/evidence/security-pass.md`
- Fixes for any finding, BL-01 entries for the rest

## Validation Gate

```bash
set -euo pipefail
gitleaks detect --source . --log-opts="--all" --redact --no-banner
./scripts/check-no-secrets.sh
# key literal in history: prints only a count
git log -p --all | grep -ciE 'x-api-key *[:=] *[A-Za-z0-9_-]{16,}' | grep -qx 0   # no header-with-value pattern in history
npx vitest run tests/security
npm audit --omit=dev --audit-level=high
npm run build
! grep -rIl 'X-Api-Key' .next/static 2>/dev/null
for h in content-security-policy x-content-type-options referrer-policy; do
  curl -sI "${DEMO_URL:?set DEMO_URL}" | tr 'A-Z' 'a-z' | grep -q "^$h:" || { echo "missing $h"; exit 1; }
done
```

## Handoff

M4-GATE reruns the secret scan and header checks from a clean clone. M4-SUBMIT relies on this pass before the owner makes the repo public. README honest-limits (M4-01) cites `docs/evidence/security-pass.md`.
