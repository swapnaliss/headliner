# M0 gate evidence

Run 2026-10-26 from a clean clone of `main` (`git clone .`), production `https://headliner-ai.vercel.app`. No secret appears below.

Two deviations from the gate text, both approved or forced:
- Step 1 ran `python3 scripts/check-prereqs.py --ticket M0-GATE` (owner approved on 2026-10-26). The full inventory still lists later-milestone items as missing; see the end of this file.
- Step 5 checked `docs/outreach/` in the owner's main checkout, because that directory is gitignored by design and so absent from a clone.

## Output
```
== 1 prerequisites (--ticket M0-GATE)
ok      P-02   Qloo hackathon API key available to the project (never printed)
ok      P-04   Neon Postgres database and connection string
ok      P-08   Budget ceiling of 6 USD approved
ok      P-18   Standing approvals decided by the owner (merge green PRs, Vercel deploys, live Qloo calls within quota, npm installs from lockfile)

4/4 ready
== clean clone: npm ci && npm run check
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.
 Test Files  8 passed (8)
      Tests  86 passed (86)
✓ Compiled successfully in 5.4s
✓ Generating static pages using 3 workers (3/3) in 171ms
== 2 hello deploy
true
banner-ok
== 3 fixtures
true
latency-ok
== 4 ADR + scoring
adr-accepted
 Test Files  2 passed (2)
      Tests  33 passed (33)
== 5 harness + outreach (outreach checked in main checkout: gitignored)
harness-ok
outreach-drafts-exist
== 6 cache + migration
 Test Files  2 passed (2)
      Tests  8 passed (8)
migration-in-sync
== 7 licence + secrets
licence-MIT
check-no-secrets: ok
{"conclusion":"success","headSha":"f07b5a70b16bb324067300e5b81c9721e5678dd9"}
M0 GATE PASS (with --ticket M0-GATE and outreach checked in main checkout)
```

## Still missing in the full inventory (not needed by M0)
P-05 and P-13 (LLM key, decision pending), P-06 (Devpost, owner says done), P-10 gitleaks, P-11 Playwright, P-14 test branch, P-15 uptime monitor, P-16 public-repo OK.
