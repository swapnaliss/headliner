# M3-GATE evidence

- Date: 2026-10-28 (UTC; runs between 06:55 and 09:00)
- Commit gated: `6392d45c807087d5934e806d10462e5a5e3717c5` (main, merge of PR #84, Rich Brian heatmaps). The first clean-clone run was on `8cd3b45` (main, PR #83) before #84 merged; both are reported.
- Production URL: https://headliner-ai.vercel.app (`DEMO_MODE=live`)
- Gate issue: #28. Scripts added: `scripts/m3-gate-clean-clone.sh`, `scripts/m3-gate-fallback.sh`, `scripts/m3-gate-prod-chunks.sh`.
- Verdict is **not** posted here: the AC table below is the gate runner's measurement; the manager decides the final verdict. Two ACs are not fully met (CI "eval job required", and the sentence "monitor shows up" which only the owner can see); see the table.

No key, connection string or raw address appears below. The local fallback proof used the documentation address `203.0.113.77`, shown only as the string searched for.

## Where each proof ran

| Proof | Where |
|---|---|
| Check 1 (lint, typecheck, tests, evals, proof, a11y, keyboard, e2e, gitleaks) | Clean clone of origin/main in a temp dir, **empty environment** (`env -i`, `DEMO_MODE=fixtures`, no `.env`, no keys, no DB); stricter than the ticket's `env -u` form |
| Checks 2, 6 | GitHub (Actions API, `gh workflow run`) |
| Check 3 (health, banner, intake, slate, explanation, logs) | **Production** |
| Check 4 (deterministic fallback with LLM budget 0) | **Local production build** (`next start`, `DEMO_MODE=live`) against the **throwaway test database** (`TEST_DATABASE_URL`) only; **not run on production** |
| Checks 5, 7, 8, 9 | Repository files, production responses, `vercel logs`, GitHub |

## Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| 1. Fixtures, no keys: lint, typecheck, tests, `eval:agent`, `proof`, a11y suite exit 0 | **PASS** (run 2); run 1 had 3 browser failures that did not recur | Run 2 on `6392d45`: all steps exit 0, details below. Run 1 on `8cd3b45`: 2 a11y tests and 1 e2e test failed once (see "Flakiness"), everything else passed |
| 2. CI green on default branch with the eval job required | **PARTIAL / FAIL on "required"** | CI green (below). Branch protection cannot be set: `gh api repos/swapnaliss/headliner/branches/main/protection` -> `{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature.","status":"403"}`. The `Agent evals` job runs on every push and PR (26 s) but is not a required status check. Owner action: set it when the repo is public |
| 3. Production slate run end to end from one sentence with explanation; fallback shown with LLM budget 0 | **PASS** (production run, n=1; fallback proven locally) | Sections 3 and 4 |
| 4. `docs/evidence/{home-city-check,fit-sanity,agent-evals,ui-review-m3}.md` exist, non-empty | **PASS** | 8,395 / 4,509 / 6,928 / 3,120 bytes on the gated commit (`wc -c`) |
| 5. Monitor and `/api/health` verified on the production URL | **PASS for health and the repo workflow; owner must confirm UptimeRobot** | Section 6. Cannot see UptimeRobot |
| 6. No key, header or raw upstream error in repo, fixtures, logs, screenshots | **PASS** | Section 7 |
| 7. LLM spend within the approved ceiling | **PASS by recorded usage (about 0.0077 USD); provider dashboard not readable by the runner** | Section 8 |

## 1. Clean clone, empty environment (`scripts/m3-gate-clean-clone.sh`)

Command (per step, in the clone): `env -i PATH HOME TMPDIR NO_COLOR=1 DEMO_MODE=fixtures <cmd>`; `npm run --silent` for `eval:agent` and `proof`. The ticket's Playwright path `apps/web/tests/a11y apps/web/tests/keyboard` matches the layout (root `playwright.config.ts` re-exports `apps/web/playwright.config.ts`), so the ticket's command ran verbatim as `npx playwright test apps/web/tests/a11y apps/web/tests/keyboard --reporter=line` with `E2E_PORT=3400`. Specs: `apps/web/tests/a11y/sweep.spec.ts` (112 sweep tests: 28 scenes x 360 and 1280 px x light and dark) and `apps/web/tests/keyboard/journey.spec.ts`; total 115. I also ran `apps/web/e2e` (36 tests), which the ticket does not ask for.

| Step | Run 2 on `6392d45` (idle machine) | Run 1 on `8cd3b45` |
|---|---|---|
| gitleaks tree | exit 1, 18 s: only gitignored `.next` build output (reused, already-built clone; see note) | exit 0, 18 s (before any build) |
| gitleaks full history | exit 0, 16 s | exit 0, 16 s |
| `npm ci` | (reused node_modules from run 1) | exit 0, 34 s |
| `npm run lint` | exit 0, 14 s | exit 0, 14 s |
| `npm run typecheck` (workspaces + `evals/tsconfig.json`) | exit 0, 54 s | exit 0, 54 s |
| `npm test` | exit 0; **71 files passed, 1 skipped; 816 tests passed, 6 skipped**; about 88 s | same counts |
| `npm run --silent eval:agent` | exit 0: `ground truth: 15 cases, trajectories: 39, injections: 18, tool failures: 15, adversarial: 19; 106 passed, 0 failed (1391 assertions)` | the same output, but the first attempt exited 1, see "Environment note" |
| `npm run --silent proof` | exit 0: `home-city: 12 of 15 resolved acts (15 listed); enough-data reading 12 of 15` and `fit-sanity: 11 of 12 same-genre candidates above their control (3 crowds)` | `home-city: 11 of 14 ...` (pre-#84), `fit-sanity` 11 of 12 |
| `npm run build -w apps/web` | exit 0 | exit 0, 30 s |
| a11y + keyboard Playwright | **115 passed (2.8 min)** | **113 passed, 2 failed** (6.3 min; machine busy with my other checks) |
| `apps/web/e2e` Playwright | **36 passed (40.6 s)** | **35 passed, 1 failed** |
| `./scripts/check-no-secrets.sh` | exit 0 (`check-no-secrets: ok`) | exit 0 |
| `git diff docs/evidence` after eval:agent and proof | **0 lines, no untracked files** | 0 lines |

The "parallel PR may merge" case happened: #84 merged during the run, so `proof` was run on both commits. Before: 11 of 14 (Rich Brian resolved but with no heatmap recorded, left out of the denominators). After: **12 of 15**, strict reading also 12 of 15; fit-sanity 11 of 12, byte-identical. The committed `docs/evidence/home-city-check.md` states 12 of 15, so the report and the replay agree.

Note on gitleaks: the script's second run (reused clone, already built) exited 1 on the tree scan: 6 findings, all in `apps/web/.next/cache/.previewinfo`, `.next/prerender-manifest.json` and `.next/server/preview-props.json` (Next.js build output, gitignored, generated preview keys). The same artefact was noted in the M2 gate. The scan before any build (run 1) and the full-history scan are clean.

### Flakiness (honest account)

In run 1, `slate-with-notes · dark · 360px` and `· 1280px` (a11y sweep) failed with `expect(await page.title()).toMatch(/Headliner/)` receiving `""`, and `apps/web/e2e/explanation.spec.ts:7` ("the sample slate shows the template explanation under the banner") failed because the locator `getByRole('region', { name: 'Explanation' })` resolved to two elements (strict mode). Run 2 on the next commit with an idle machine passed all 115 and all 36. I did not isolate the cause. The symptoms (an empty title and two Explanation regions at the same moment) fit the streamed Suspense explanation block (the production HTML also carries a template block followed by the streamed final block), so a timing race under CPU load is likely but **not proven**. One failing run in two means these specs are not reliably green; logged on BL-01 (owner tickets M3-06 / M3-02).

### Environment note

The first `eval:agent` and `proof` attempts exited 1 with `listen EINVAL ... .pipe`: tsx opens a unix socket under `TMPDIR`, and my TMPDIR path was over the 107-character socket limit. Not a product defect; the script now uses a short `TMPDIR`. Both passed on re-run.

## 2. CI on main

`gh run list --branch main`: run 40646118111, "M3-06 (#83)", commit `8cd3b45`, success. Jobs: `check` success, 06:48:37 to 06:52:20 = **3 min 43 s**; `Agent evals` success, 06:48:37 to 06:49:03 = **26 s**; run 3 min 46 s (target 5 min). Previous run 40643698297 (#82): success, 3 min 36 s. The run for #84 (`6392d45`): run 40650272488, success, 2 min 55 s. Scheduled `Keep warm` and `Uptime` runs show `skipped` because the repo is private (guard in the workflow files).

## 3. Production, end to end (n=1, 2026-10-28 07:21 to 07:24 UTC)

| Step | Result |
|---|---|
| `GET /api/health` | 200, 1.58 s: `{"ok":true,"mode":"live","version":"0.1.0"}` |
| `GET /api/health?deep=1` | 200, 0.58 s: `{"ok":true,"mode":"live","version":"0.1.0","db":"ok"}` |
| `GET /` banner | `aggregate affinity, not a ticket forecast` present (count 1) |
| `POST /api/intake`, one sentence: "We run an electronic club in Berlin; our regulars love Apparat, Moderat, Modeselektor, Hundreds, Brandt Brauer Frick and Boys Noize. Compare Khruangbin, Radiohead and Reality Club." | 200, **3.89 s**, `status:"room"`, `mode:"agent"`, `source:"model"`, 1 turn, 844 tokens, 0.0000674 USD; room city Berlin, 6 crowd acts, 3 candidates, `cities: []`, `steps: 1` |
| `POST /api/slates` with that room | 200, **0.47 s** (all names already cached), `status:"done"` directly: every name matched exactly, so no match-confirmation screen appeared and the confirm step was not needed. Ranked: 1 Reality Club Fit 60.6 (71 shared tags), 2 Radiohead 59.5 (86), 3 Khruangbin 58.1 (46) |
| `GET /api/slates/<id>` | 200, **2.26 s**, explanation `source:"llm"`, text checked against the slate (figures 60.6, 59.5, 58.1, 86.4, 100.0, 99.5 all present in the slate); the second GET returned 0.2 s from the server's cache |
| `GET /slates/<id>` page | 200, 3.09 s. The HTML first carries the template block (`data-source="template"`, label "Template.") then the streamed final block `data-testid="explanation" data-source="llm"` with the label "Written from checked facts. Every figure in this text was checked against this slate before it was shown." **Final source: `llm`**, not `template` |

The slate was produced for a room that was fully cached, so this is **not a cold-slate measurement**; the 0.47 s is the stored-pipeline path. Cold timing remains in `docs/evidence/qloo-cold-slate.md`. n=1 for every timing.

### Structured logs from `vercel logs` (worked: scope team and project id from the owner's local link)

`vercel logs --scope <team> -p <project id> --since 30m --json` returned 31 runtime lines. Relevant lines (run ids removed):

```
POST /api/intake       {"level":"info","event":"llm_usage","model":"gpt-5-nano","in":772,"out":72,"reasoning":0,"costUsd":0.000067}
POST /api/intake       {"kind":"route","endpoint":"POST /api/intake","latencyMs":2691,"status":200,"cacheHit":false,"budget":"allow"}
POST /api/slates       12 x {"kind":"qloo",...,"latencyMs":0,"status":200,"cacheHit":true}   (9 /search, 3 /v2/insights/compare)
POST /api/slates       {"kind":"route","endpoint":"POST /api/slates","latencyMs":102,"status":200,"cacheHit":true,"budget":"allow","qloo":{"upstreamCalls":0,"retries":0,"status429":0,"cacheHits":12,"staleServed":0,"failures":0}}
GET /api/slates/<id>   {"level":"info","event":"llm_usage","model":"gpt-5-nano","in":1018,"out":187,"reasoning":0,"costUsd":0.000126}
GET /api/slates/<id>   {"kind":"llm","endpoint":"explain","source":"llm","budget":"allow","model":"gpt-5-nano","inputTokens":1018,"outputTokens":187,"costUsd":0.000126}
GET /api/slates/<id>   {"kind":"llm","endpoint":"explain","source":"llm","budget":"none"}            (second GET, no model call)
GET /slates/<id>       {"kind":"llm","runId":"none","endpoint":"explain","source":"llm","budget":"allow","model":"gpt-5-nano","inputTokens":1018,"outputTokens":187,"costUsd":0.000126}
```

Qloo call behaviour for this slate: `upstreamCalls 0`, `retries 0`, `status429 0`, `cacheHits 12`, `failures 0`. This confirms the M3-05 route-line counts are visible on production. A cold slate was **not** run (budget for production use was one cold-ish slate at most and none was needed), so retry and 429 behaviour on a cold production slate is **not measured here**.

Observations: (a) the intake route line carries no `qloo` counts and no `kind:"llm"` line (only the `llm_usage` event); (b) the page render logs `runId:"none"` and called the model again (the in-memory explanation cache is not shared between the API route and the page render, so one slate viewed through both paths cost 2 model calls, plus the first GET's); both logged on BL-01.

## 4. Deterministic fallback with LLM budget zero (`scripts/m3-gate-fallback.sh`) — proven LOCALLY, not on production

Local `next start` of the built clone, `DEMO_MODE=live`, real Qloo key, `DATABASE_URL` pointed at `TEST_DATABASE_URL` (production `DATABASE_URL` not used), `BUDGET_GLOBAL_LLM_TOKENS=0 BUDGET_IP_LLM_TOKENS=0`. The model key was a **dummy** (`sk-invalid-...`), so no spend was possible and any attempted call would show as an error rather than a budget denial.

```
Phase 1 (budget 0)
POST /api/intake  -> {"status":"deterministic","mode":"deterministic","reason":"budget","steps":0,"usage":{"turns":0,"tokens":0,"costUsd":0}}  HTTP 200
POST /api/slates  -> HTTP 200 (live Qloo, slate id present)
GET  /api/slates/<id> -> {"source":"template", ...}
log: {"kind":"llm","endpoint":"explain","source":"template","budget":"deny","errorCode":"budget"}; budget_llm_degraded for routes explain and intake; llm_usage lines: 0
Phase 2 (control, default budgets, same dummy key)
POST /api/intake  -> {"status":"deterministic","mode":"deterministic","reason":"llm_error",...}
GET  /api/slates/<id> -> {"source":"template"}; log: {"kind":"llm","endpoint":"explain","source":"template","budget":"allow","errorCode":"error"}
```

The control shows the call IS attempted when the budget allows (and fails with the dummy key), so `reason: "budget"` in phase 1 means the guard answered before any model call. `x-api-key` 0, dummy key value 0 and raw test address 0 occurrences in server logs and responses. Only the throwaway database was used.

## 5. Evidence files and wording audit

- Non-empty: `home-city-check.md`, `fit-sanity.md`, `agent-evals.md`, `ui-review-m3.md`.
- `grep -rniE 'forecast|turnout|will sell' apps/web/app docs/evidence | grep -viE 'not a ticket forecast|never'` printed **nothing** (re-run on the gated commit `6392d45`: 0 lines). Wider: `apps/web/src` and `packages/*/src` hit only the grounding blocklist, its tests and the prompt's "Never write ..." line. `README.md` has only "Aggregate affinity, not a ticket forecast."; `PROJECT.md` lines 24 and 59 say "never a ... forecast", "does not forecast ticket sales or turnout ... show momentum (the hackathon trending data is flat)".
- Momentum audit (`momentum|trending up|rising|surge|growth` over app, src, packages, README, evidence): only the blocklist and "flat" statements; no momentum claim in the product.
- Numbers versus claims: the evidence reports say 12 of 15 (home city; strict also 12 of 15) and 11 of 12 (fit sanity), each with its sample and limits. **Mismatch found:** `PROJECT.md` line 22 (success metric) still reads "(3 of 3 observed in recon)"; it is labelled as recon, not the measurement, but should quote the measured 12 of 15 when M4-01 fills the README. `README.md` is still a stub with placeholder comments (M4-01), so it carries no numeric claim to audit. The UI's text contains no measured-result number.
- Home-city check is a small hand-picked sample; the three misses are Seoul acts (see the report).

## 6. Monitor

- `/api/health?deep=1` green on production (section 3), `db:"ok"`.
- `gh workflow run uptime.yml -R swapnaliss/headliner` -> run 40649618697, `workflow_dispatch`, **success**, 10 s; log: `attempt 1: HTTP 200`, `healthy`.
- Vercel request records show `HEAD /api/health` every 5 minutes (06:59, 07:04, 07:09, 07:14, 07:19 UTC), each answered 200 with `latencyMs` 29 to 643: consistent with the external monitor's 5-minute interval, but the sender is not identified in the log, so this does not prove which service it is.
- **Owner action:** confirm in the UptimeRobot console that the monitor (name to be confirmed, `headliner-health` per `docs/runbook.md`) shows Up with an email contact. The runner cannot see it. Scheduled `uptime.yml` runs skip while the repo is private (by design).

## 7. Secrets and leakage

- `./scripts/check-no-secrets.sh`: `check-no-secrets: ok` (all runs).
- gitleaks (clean clone): working tree and full history clean before build (run 1: exit 0 both); after a build the tree scan flags only gitignored `.next` preview keys (above). Full history clean in both runs.
- Production client (`scripts/m3-gate-prod-chunks.sh`): 12 client chunks (735,058 bytes) from `/`, a sample page, a sample act page and the new slate page: matches for `X-Api-Key`, the Qloo host, `QLOO_API_KEY`, `OPENAI_API_KEY`, `api.openai.com`, `Bearer`, and `sk-` key shapes: **0** in chunks, **0** in page HTML, **0** in a 404 page.
- Raw upstream error text: `POST /api/slates {"city":""}` -> 400 `{"error":{"code":"invalid_input","message":"The request is not valid. Check: city, crowdActs, candidateActs."}}`: fixed message, nothing echoed. The Qloo-side non-leakage is covered by `packages/qloo/test/redaction.test.ts` and the route tests (M1-GATE note); the fallback proof run found `x-api-key` 0 in logs and responses.
- Fixtures, screenshots, evidence: `X-Api-Key` appears only as descriptive prose in `docs/evidence/{m1-gate,m2-gate,harness-check}.md` and as an attack string in `fixtures/agent/evals/intake/adv-ke-print-keys.json` (an adversarial input asking the model to print keys); the Qloo hostname appears in evidence prose and `fixtures/qloo/README.md` (a hostname is not a secret). No key-shaped string (`sk-...`) in `fixtures` or `docs`. Screenshots (`docs/screenshots/*.png`, 8 files) were not pixel-inspected by me.

## 8. LLM spend to date (recorded, not provider-confirmed)

| Source | Recorded cost (USD) |
|---|---|
| M3-01 worker report (#22) | about 0.0025 |
| M3-02 worker report (#23) | about 0.0014 |
| M3-03 worker report (#24) | 0.00345 |
| This gate, production: 1 intake call | 0.000067 |
| This gate, production: 3 explanation calls (GET API, second GET served from cache, page render) | 0.000126 + 0.000126 = 0.000252 |
| **Total** | **about 0.0077** |

Ceiling: 5 USD provider-side, 6 USD total (`docs/budget.md`). Recorded usage is about 0.15% of the provider cap. **The provider dashboard cannot be read by the runner; the owner should glance at the OpenAI usage page** (and note that the 5 USD hard limit is set in the provider console, which I could not see either). Cost is computed from tokens reported by the API, not billed amounts.

## 9. Other collected facts

- `python3 scripts/check-prereqs.py` (full inventory): from a bare worktree with no `.env` and no `.vercel` link it reports `12/18 ready, 6 required missing` (P-02, P-04, P-05, P-12, P-13, P-14 — environment not reachable). With the repo's environment file and Vercel link reachable (symlinked, values not read by me): **`18/18 ready`, exit 0**, two items `skip` (P-07 Discord, P-17 video). The M3 resources P-02 (Qloo key), P-05 (OpenAI key), P-11 (Playwright) and P-13 (Vercel `OPENAI_API_KEY`) are `ok`. Note: P-05 and P-13 are marked ok by the script checking presence, not that the 5 USD provider limit is set.
- ui-reviewer verdicts in the M3 PR bodies: #81 (M3-02) round 1 **PASS**, 0 blocking, 4 polish, axe 0 violations in 24 runs; #83 (M3-06) round 1 **PASS**, 0 blocking, 3 polish, axe 0 serious/critical (168 captures, plus 112 sweep tests); #78 (M3-05) and #82 (M3-03): no ui-reviewer entry in the PR body (no UI change). The reviewer read a sample of the captures, not all (stated in `ui-review-m3.md`). ui-reviewer was not re-run on production pages here.
- Known limits carried (not new): no screen-reader pass, no 200% zoom or text-spacing automation, 320 px untested (`ui-review-m3.md`); lowercase invented act name and a real figure attached to the wrong meaning are not caught by `groundingCheck` (`agent-evals.md`); the confirm-screen extras were not built (owner-confirmed deferral per the M3-06 handoff).
- Test counts: unit 816 passed + 6 skipped (71 files + 1 skipped file); agent evals 106 assertions-groups passed (1391 assertions); Playwright a11y/keyboard 115; e2e 36.

## What was not verified

- The OpenAI provider dashboard and the 5 USD limit; the UptimeRobot console.
- A cold production slate (retry and 429 counts under a real cold load); a real 429 on production.
- The deterministic fallback on production (proven locally only).
- Cause of the run-1 browser failures.
- Screen reader, 200% zoom, 320 px.
