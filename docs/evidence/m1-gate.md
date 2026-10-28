# M1-GATE evidence

- Date: 2026-10-26
- Commit gated: `91887ae6d073f1d2c7f715ef5479af5b6c68ef1f` (main, merge of PR #46)
- Production URL: https://headliner-ai.vercel.app (`DEMO_MODE=live`, Vercel Authentication off)
- Gate issue: #14. Clean-clone script: `scripts/m1-gate.sh` (reusable by M2-GATE and M4-GATE).

No secrets appear below. The gate ran with no `.env` and no keys in the environment (`env -i`).

## Blockers

M1-01 (#9), M1-02 (#10), M1-03 (#11), M1-04 (#12), M1-05 (#13) and M0-GATE (#8) are closed. PRs #42 to #46 merged with a green check each.

## Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| Fresh clone, no keys: install, test, build, serve in fixtures; `POST /api/slates` returns a ranked Slate with Evidence | PASS | `scripts/m1-gate.sh` exit 0 (below): `npm ci`, typecheck, lint clean; 27 test files passed, 1 skipped; 290 tests passed, 1 skipped; build ok; health `{"ok":true,"mode":"fixtures","version":"0.1.0"}`; slate 30181 bytes, `"status":"done"`, 4 `"evidence"` fields |
| Production `/` and `/api/health` 200, Banner shown, production run returns ranked Slate | PASS | health 200 (`{"ok":true,"mode":"live","version":"0.1.0"}`), `/` 200 with "aggregate affinity, not a ticket forecast"; one POST of the recorded room (`room.json` in `apps/web/test/fixtures`) returned 200 `status:"done"`, 4 scored acts ranked 1 to 4, 32 Evidence entries |
| CI green on main within 5 minutes | PASS | run 40311351236 on `91887ae`: success, job `check` 90 s (10:57:10 to 10:58:40), run 99 s |
| gitleaks no findings; no client chunk has `X-Api-Key` or the Qloo host | PASS | tree and 15-commit history: no leaks; fresh-clone `.next/static`: no match; 10 deployed production chunks fetched: no match |
| `LICENSE` is MIT | PASS | first line "MIT License", "Copyright (c) 2026 swapnaliss" |
| `docs/evidence/m1-gate.md` lists SHA, URL, results | PASS | this file |
| `ui-reviewer` no unresolved blocking findings | PASS | verdict PASS, 0 blocking, 10 polish (below) |

Deviation: the ticket's Validation Gate block could not be executed as one pasted script here, because the agent harness refused to run a computed or piped shell containing `git` from a worktree. Its steps were run by `scripts/m1-gate.sh` (same clone, `env -u` equivalent via `env -i`, `npm ci`, typecheck, lint, tests, build, start, POST, key greps, gitleaks, MIT) and individually (health, Banner, `gh run list`). The block's final `test -s docs/evidence/m1-gate.md` is satisfied once this file is merged to main.

## Clean-clone run (`scripts/m1-gate.sh`, exit 0, 83 s wall, n=1)

```
== clone https://github.com/swapnaliss/headliner.git @ main
commit: 91887ae6d073f1d2c7f715ef5479af5b6c68ef1f
tree: no leaks
history: no leaks
 Test Files  27 passed | 1 skipped (28)
      Tests  290 passed | 1 skipped (291)
   Duration  33.64s
Route (app): / , /_not-found , /api/health , /api/slates , /slates/[id]  (all dynamic)
health: {"ok":true,"mode":"fixtures","version":"0.1.0"}
slate bytes: 30181; evidence entries: 4
no X-Api-Key in response/log; no X-Api-Key or Qloo host in apps/web/.next/static
server process group stopped; leftover next-server from this run: 0
LICENSE is MIT
m1-gate: ok (clean clone, no keys)
```

The script runs the server under `setsid` and kills its process group (TERM, then KILL) on exit.

## Production check (n=1, not repeated)

| Request | Result |
|---|---|
| `GET /api/health` | 200, 1.01 s, `{"ok":true,"mode":"live","version":"0.1.0"}` |
| `GET /` | 200, 1.03 s, Banner string present |
| `POST /api/slates` (recorded Berlin room, 6 crowd acts, 4 candidates) | 200, 4.74 s total, `cache-control: no-store`, `stale:false`, `unresolvedCrowdActs: []` |
| `GET /slates/AkpS-b_WZaw2kcYZBJ-Re` | 200, 1.62 s, title "Slate for Berlin: Headliner", Banner present, all 4 act names and "Qloo popularity rank" rendered |
| `GET /slates/doesnotexist123` | 404 page |
| `POST /api/slates` `{"city":""}` and non-JSON body | 400 `invalid_input`, fixed message, nothing echoed |

Ranked result: 1 Reality Club 60.6 (71 shared tags), 2 Radiohead 59.5 (86), 3 Hindia 58.8 (66), 4 Khruangbin 58.1 (46). All caveat lists empty. Each act carries 8 Evidence entries (endpoint, redacted params, response digest, fetchedAt): 32 in total. The response contains no `X-Api-Key` string.

Call behaviour: the response does not expose the number of upstream calls, retries or 429s, so these cannot be reported from the response. The 4.74 s wall time is consistent with a mostly warm Postgres cache from earlier runs, not with a cold 39-call slate; it is not a cold-start measurement. Cold timing remains in `docs/evidence/qloo-cold-slate.md`.

## Safety checks

- Responses and logs: fixtures run server log and slate contain no `x-api-key` (case-insensitive). Production error responses are fixed-message JSON. Raw upstream error non-leakage is covered by `packages/qloo/test/redaction.test.ts` (every failure status, hostile bodies, fetch exceptions) and `apps/web/test/slates.route.test.ts` ("safe errors and no leaks": 500, 429, transport exception, internal error).
- Production server logs were not inspected (no log access used); only the above tests and response checks back this.

## ui-reviewer (deployed pages, `.review/M1-GATE/`, gitignored)

Captured with Playwright (Chromium) at 375, 768 and 1440 wide, light and dark, for `/`, the real slate page and a not-found slate: 18 screenshots plus 18 axe JSON files. Axe (wcag2a, wcag2aa, wcag21aa, best-practice): 0 violations in all 18 runs, no horizontal overflow, not-found pages return 404.

Verdict: **PASS**, no blocking issues. The reviewer opened 375 light and dark, 768 dark and 1440 light and dark, not every capture. Polish items (none blocking; owners M2 and M3-06 unless stated):

1. Demo-mode chip missing on every page: correct, production runs `live` (verified by `/api/health`).
2. Candidate label says 1 to 12, spec says 3 to 12: spec and shared zod schema disagree.
3. Button copy "Rank these acts" vs spec "Check matches": align when M2-01 lands.
4. "Describe it in one sentence" disclosure has no open/closed marker.
5. Disabled primary button uses a dashed border and weak contrast.
6. "Compared with 6 crowd acts" summary has no marker.
7. "Evidence (8 calls)" link: confirm target is real.
8. Comparison table at 375: act name wraps.
9. Not-found page has two consecutive headings (h1 "Not found" plus EmptyState title).
10. Fit number and rank 1 need more visual weight at 1440.

## Measured numbers

| Measure | Value | Sample |
|---|---|---|
| Production slate time | 4.74 s | n=1, warm cache likely |
| Slate page render | 1.62 s | n=1 |
| CI duration | 99 s run, 90 s job | latest main run, n=1 (target 300 s) |
| Tests | 290 passed, 1 skipped, 27 files (1 skipped) | clean clone |
| Clean-clone gate wall time | 83 s | n=1 |
