# M2-GATE evidence

- Date: 2026-10-27 (UTC, runs between 09:12 and 09:35)
- Commit gated: `1a6c16b0079c417a788d074efba538ef953bad47` (main, merge of PR #70)
- Production URL: https://headliner-ai.vercel.app (`DEMO_MODE=live`)
- Gate issue: #21. Scripts added: `scripts/m2-gate-journey.mts`, `scripts/m2-gate-abuse.sh`, `scripts/m2-gate-db.mts`, `scripts/m2-gate-fixtures-steps.sh`; `scripts/m1-gate.sh` gained two optional hooks (`M1_GATE_EXTRA`, `M1_GATE_E2E`).

No key, connection string or raw address appears below. Test addresses used locally are documentation ranges (203.0.113.0/24, 2001:db8::/32) and are shown only as the literal strings searched for.

## Where each proof ran

| Proof | Where |
|---|---|
| Steps 1 to 9 and the journey timings | **Production** (deployed host), real Playwright Chromium and curl |
| Step 10: per-IP 429, fresh IP, global ceiling, no raw IP in logs or rows | **Local production build** (`next build` + `next start`, `DEMO_MODE=live`, real Qloo key) against the **throwaway Neon test branch** (`TEST_DATABASE_URL`, P-14) only. Production `DATABASE_URL` was not used by any script. |
| Step 10 on the deployed host | Only non-destructive parts: sample rooms and stored slates load, health ok, a fresh typed request is allowed (the journey). **A real 429 on production was not provoked.** |
| Step 11 | Clean clone of main in a temp dir, `env -i`, `DEMO_MODE=fixtures`, no keys, no DB |

## Prerequisites and blockers

- Blockers #15 to #20 (M2-01 to M2-06) are closed; PRs #63, #65, #66, #67, #69, #70 merged.
- `check-prereqs --ticket M2-GATE` (run from the owner's local tooling; not part of the public tree): `ok P-12 ... 1/1 ready`.
- `check-prereqs` (full form): `13/18 ready, 5 required missing`: P-05 (OpenAI key), P-06 (Devpost), P-13 (Vercel `OPENAI_API_KEY`), P-15 (uptime monitor), P-16 (repo public approval). All belong to later milestones. **AC "no missing required item" therefore FAILS in the full form** (owner decision needed). Note: from a fresh worktree that has no `.env` and no `.vercel` link the full form also reports P-02, P-04, P-12 and P-14 missing; with the repo's environment file and Vercel link reachable they are `ok`.
- CI on main at `1a6c16b`: run 40476039783, success; job `check` 146 s (08:48:03 to 08:50:29), run 149 s. Target 300 s.

## Storyboard

| # | Result | Evidence |
|---|---|---|
| 1 | PASS | Production `GET /` 200 in 0.37 s; `aggregate affinity, not a ticket forecast` count 1 (curl grep) and visible in the browser; the "Demo limits" panel reads: "each visitor gets 150 live Qloo calls a day ... names already looked up cost nothing. The limit resets at midnight UTC. The sample rooms are saved runs ... always available ... No login, no CAPTCHA." No password input or CAPTCHA element on the page. |
| 2 | PASS | Production browser, room "London": 6 crowd acts (Radiohead, Portishead, Massive Attack, Bonobo, Four Tet, Burial) and 5 candidates (Khruangbin, Caribou, Floating Points, Bjork, Wynn Delacroix). `POST /api/slates` 200 returned the match screen, status line "2 names need your choice, 9 confirmed", groups "Which Bjork?" and "Which Wynn Delacroix?". The Rank button had `aria-disabled="true"` before the choices; a forced press stayed on `/run/<id>/confirm` and made no further API call (only `POST /api/slates 200` seen). After choosing Björk and Timothy Michael Wynn the button enabled and ranked. Also covered by the clean-clone checks below (confirm with no choice 400, foreign entity id 400). |
| 3 | PASS | Slate ranked: 1 Floating Points Fit 62.1 (57 shared tastes), 2 Björk 61.8 (112), 3 Caribou 61.8 (125; "Same Fit as the act above; ordered by name"), 4 Khruangbin 58.1 (151); every card has Fit, tags, shared-taste count, "Qloo popularity rank" with percentile versus crowd median, caveats (Björk: match chosen by you). 5 cards carry the "Qloo popularity rank" label. Banner present. |
| 4 | PASS | The compare table on the slate: "The orders differ: 4 of 4 acts sit in a different position." **Fit order**: Floating Points, Björk, Caribou, Khruangbin. **Qloo popularity-rank order**: Björk (1), Caribou (2), Khruangbin (3), Floating Points (4). Nothing tuned. |
| 5 | PASS | Top act page (Floating Points): shared tastes table (Electronic 0.73, 6 of 6 crowd acts; Energetic 0.73, 1 of 6; Dynamic 0.73, 4 of 6 ...), "Evidence trail (8 calls)" with 8 rows; the opened requests read like `GET /search query=Floating Points types=urn:entity:artist take=5 status=ok fetchedAt=... responseDigest=...` and `GET /v2/insights/compare filter.type=urn:entity:artist a.signal.interests.entities=<ids> b.signal.interests.entities=<id> status=ok ...`. Page HTML contains no `x-api-key`, `authorization`, `bearer`, api-key wording, or the Qloo host. |
| 6 | PASS | Lazy: 0 `/cities` requests before the city section scrolled into view, 4 after (one per city: London, Leipzig, Jakarta, Tromsø), "City strength loaded for 4 cities. 1 has thin data." (7.7 s on production for the 4 live calls). **Tromsø: mean affinity rank 0.608, 8 cells, "Thin data: only 8 Qloo heatmap cells for this city (fewer than 15)"** (real response; Jakarta 90 and Mumbai 89 cells for this act were not thin, probed on the test stack). The pinned Berlin sample's act page on production also shows the saved result "City strength loaded for 4 cities. 2 have thin data." |
| 7 | PASS | Typed "Wynn Delacroix"; Qloo returned fuzzy candidates (Joris Delacroix, Tim Wynn, Timothy Michael Wynn, ...); choosing **Timothy Michael Wynn** (a composer) gave a real entity with no usable tags: card under "Not ranked (1)": "No data for Timothy Michael Wynn. Qloo returned nothing usable for this act, so no Fit or Qloo popularity rank is shown." and caveat "Qloo returned no shared audience tags for this act, so no audience-taste fit is shown." No number is shown. Found by probing on the local test stack (Qloo never says "unknown": it fuzzy-matches every typed name; "Lunar Tide Collective", "Pelagic Hum" produced ambiguous candidates). The "not in the recordings" empty state is the fixtures-mode variant (step 11). |
| 8 | PASS | Link from the owner page's "Link to this slate" field (`https://headliner-ai.vercel.app/s/<21-char id>`), opened in a new browser context with no cookies: 200, `x-robots-tag: noindex, nofollow`, `<meta name="robots" content="noindex, nofollow">`, CSP `script-src 'self' 'nonce-<n>' 'strict-dynamic'` (no `unsafe-inline`/`unsafe-eval`), `frame-ancestors 'none'`, `cache-control: private, no-cache, no-store`, banner present, no "Copy link" control, 0 inline scripts without a nonce, 0 `<script>` in `<main>`, 0 console or CSP errors, 5 act cards. Also on production: `/s/sample-berlin-electronic/act/<id>` has the same noindex and nonce CSP; `/s/not-a-real-id` 404 with the same headers. |
| 9 | PASS with caveat | Validation loop: berlin-electronic 200 in 3.244 s (first request, cold), leipzig-indie 200 in 1.198 s. Then n=6 per sample: berlin 1.812, 0.995, 0.911, 0.890, 0.791, 0.786 s; leipzig 1.026, 0.789, 0.866, 0.732, 0.761, 0.743 s. 13 of 14 requests under 2 s; **the first cold request (3.24 s) missed 2 s** (same pattern as the manager's earlier 2.89 s). Intake page 0.37 s. |
| 10 | PASS (local proof, production non-destructive parts) | See "Step 10 detail". |
| 11 | PASS | See "Step 11 detail". |

## Core journey time (production, scripted Chromium, `scripts/m2-gate-journey.mts`)

The stopwatch starts at navigation to `/` and stops when the slate heading is visible, so it includes scripted typing (3.0 s on run 1 including page load and hydration wait, 1.2 to 1.3 s later), the create request, the match screen and the confirm request. The confirm step takes two scripted clicks (the choices), which is not human time.

| Run | Kind | Total | Form filled | Create + match screen | Confirm and rank |
|---|---|---|---|---|---|
| 1 | first run of this room; full storyboard walk afterwards | 14.26 s | 3.02 s | 6.43 s | 4.18 s |
| 2 | repeat of the same room (cached) | 8.80 s | 1.28 s | 3.58 s | 3.88 s |
| 3 | repeat of the same room (cached) | 7.72 s | 1.30 s | 2.38 s | 3.96 s |
| extra | repeat with full walk (cached) | 10.19 s | 1.22 s | 4.27 s | 4.14 s |

Sample: n=3 required runs plus 1 extra, one machine, one network path, one afternoon. Honest limit on "cold": run 1 was **not fully cold**. Production's cache already held earlier entries; the evidence trail shows the Radiohead search with `fetchedAt` 07:00 (cached) while the Floating Points search and compare are stamped 09:24 (live in this run). So run 1 is a partly cold room (new names live, popular names cached). The response does not expose the live-call count, and production budget counters could not be read (a read-only query on the production database was refused by the harness), so the number of live Qloo calls for run 1 is **not measured**; the 5 distinct new names plus 5 compares plus 4 city loads bound it at about 20. No 429, no 5xx and no error state was seen in any run (0 console or page errors). The 4 lazy city loads add about 7.7 s on first open. A human first-run stopwatch by someone unfamiliar was not done.

## Step 10 detail (local production build, throwaway test database; `scripts/m2-gate-abuse.sh`)

Real Qloo key via the environment, `DATABASE_URL` pointed at `TEST_DATABASE_URL`, `BUDGET_SALT` a test value. Different `X-Forwarded-For` values are different visitors. Each room is 3 crowd + 3 candidates, planned cost 9 (6 searches + 3 compares).

Phase A, `BUDGET_IP_QLOO_CALLS=12`:

```
A1 IP-1 room R1 (cold, live): HTTP 200 status=done     (budget row for IP-1: qloo_calls=7)
A2 IP-1 room R2 (planned 9, would exceed 12): HTTP 429
   cache-control: no-store   content-type: application/json   retry-after: 53029
   {"error":{"code":"demo_limit_reached","message":"Daily demo limit reached. Saved sample rooms and slates still work; live lookups resume after midnight UTC."}}
A3 IP-2 (fresh IPv4) room R1: HTTP 200 status=done
A4 IPv6 2001:db8:aaaa:1::7 room R1: HTTP 200 status=done
A5 IP-1 again: HTTP 429 demo_limit_reached
A6 denied IP-1 reads the stored slate: /slates/<id> 200, /s/<id> 200
A7 junk X-Forwarded-For values share ONE 'unknown' bucket: junk-1 200, junk-2 429, junk-3 429
```

The message is generic (no limit number, no address, no upstream text). `Retry-After` 53029 s was the time to the next UTC midnight when run.

Phase B, `BUDGET_GLOBAL_QLOO_CALLS=4` (per-IP 150): B1 cached room R1 -> 200 served from cache (global counter 0, i.e. no live call); B2 never-cached room R3 -> **429 `demo_limit_reached`** with `retry-after: 53016`, `qloo_cache` rows 47 before and 47 after (no live call made); server log carries 2 `budget_global_qloo` events and 4 `budget_deny` (route and reason only).

Phase C (guard called directly on the test database, because the LLM is not wired to any route until M3-01): LLM tokens 60 of 100 -> `llm=on`; a second visitor pushing the global total to 120 -> `llm=deterministic_only`; same visitor over its own 100 -> `deterministic_only`; Qloo planned 9 with ceiling 5 -> `qloo=cache_only`; budget store unreachable -> `deny store_unavailable`. Events logged: `budget_llm_degraded`, `budget_global_qloo`, `budget_store_error` with route only.

Privacy checks: server logs (24 lines): raw test addresses 0, `x-api-key` 0, the key value 0. Test database scan for `203.0.113`, `2001:db8`, `198.51.100` in `budgets`, `slates`, `runs`, `qloo_cache`: 0 each. `budgets` rows are 64-character hex hashes plus the `global` row.

Not proven here: a real 429 on the deployed host (deliberately not provoked), the LLM ceiling through a route (M3-01), behaviour with Vercel's own `x-vercel-forwarded-for` header (code reads it first; only `x-forwarded-for` was exercised locally).

## Step 11 detail (clean clone, zero keys, `scripts/m1-gate.sh` with the M2 hooks, exit 0)

Clone of main @ `1a6c16b`, `env -i`, `DEMO_MODE=fixtures`:

- gitleaks: tree no leaks, full history no leaks. `npm ci`, typecheck, lint clean.
- `npm test`: 52 test files passed, 1 skipped; 539 tests passed, 6 skipped; duration 63.3 s. `npm run build` ok (routes include `/api/slates/[id]/confirm`, `/run/[runId]/confirm`, `/s/[id]`, `/s/[id]/act/[actId]`, Proxy).
- Health `{"ok":true,"mode":"fixtures","version":"0.1.0"}`; recorded room slate 35,497 bytes, 4 evidence entries; no `X-Api-Key` in response or log; no `X-Api-Key` or Qloo host in `.next/static`.
- Steps via `scripts/m2-gate-fixtures-steps.sh`: **1** `/` 200, banner and "Demo limits" ("Daily limits are off in this recorded-responses demo"); **2** the "Bjork" room returns `awaiting_confirmation` with no results (state `not-in-recordings`, as ADR/M2-01 handoff says), confirm with no choice 400, confirm with an id that was not offered 400, confirm with skip -> done; **3** ranked 1 Reality Club 60.6, 2 Radiohead 59.5, 3 Khruangbin 58.1, each "Qloo popularity rank", slate page 200 with banner; **5** act page 200 with Shared tastes and Evidence trail, 8 evidence entries (keys endpoint, fetchedAt, id, index, params, responseDigest, status, supports), no `x-api-key`/`authorization`; **8** `/s/<id>` 200, noindex, nonce CSP, no unsafe script sources, banner, no Copy link; `/s/not-a-real-id` 404.
- Browser level (clone's Playwright suite, fixtures, no keys): 33 passed in 37.6 s, including the keyboard-only picker, share, samples and axe light and dark.
- LICENSE is MIT; no `next-server` left from the run.

## Other gate commands

- Validation Gate block run piecewise (the worktree guard refuses a computed shell containing `git`): items 1 to 7 on production as above (`/` 200, banner 1, sample loop, `/s/not-a-real-id` 404 and its headers); the clean-clone line via `scripts/m1-gate.sh`; `check-prereqs` above; `./scripts/check-no-secrets.sh` -> `check-no-secrets: ok`; the owner's local milestone-planning tool for milestone 3 (not part of the public tree) prints M3-01, M3-02, M3-04 ... held only by the open M2-GATE (plus pre-flight warnings about my dirty branch). Note: the ticket's `$(jq ... rooms.json)` path `apps/web/samples/rooms.json` is correct.
- Client bundle on production: 13 chunks (749,511 bytes) fetched from `/`, both sample pages and a sample act page: `X-Api-Key` 0, `hackathon.api.qloo.com` 0, `QLOO_API_KEY` 0.
- gitleaks on the working tree of this branch flags only `apps/web/.next/**` preview keys (gitignored build output); the clean clone has none.

## ui-reviewer verdicts recorded in the M2 PR bodies

| PR | Ticket | Verdict |
|---|---|---|
| #63 | M2-02 | round 1 CHANGES REQUIRED (4), round 2 PASS; axe 0 violations in 30 runs |
| #65 | M2-03 | rounds 1 and 2 CHANGES REQUIRED, round 3 PASS (7 polish on BL-01); axe 0 serious in 48 runs |
| #66 | M2-01 | rounds 1 to 3 CHANGES REQUIRED, round 4 PASS (polish only; round cap exceeded by one); axe 0 in 66 captures |
| #67 | M2-06 | round 1 PASS, 4 polish; axe 0 serious in 24 runs |
| #69 | M2-04 | round 1 PASS, 0 blocking, 5 polish; axe 0 in 30 captures |
| #70 | M2-05 | round 1 PASS, 0 blocking, 3 polish (reviewer opened 6 of 30 captures, not 768px); axe 0 in 18 runs |

ui-reviewer was not re-run on the deployed M2 pages (optional).

## Defects and observations (logged on BL-01)

1. Evidence trail count right after the lazy city load is not yet final: 10 calls (run 1) and 11 calls (extra run) were shown 3 s after the strip loaded; after a reload it showed 12 (8 + 4 cities). Matches the known cross-instance city save race (BL-01 6434847617, deferred in M2-04). Owner ticket: M2-03 / M2-04 follow-up.
2. First cold request of a sample page missed 2 s (3.24 s, 1.81 s on the next sample first request); steady state 0.73 to 1.0 s. Owner: M2-06.
3. AC "check-prereqs reports no missing required item" fails in the full form (P-05, P-06, P-13, P-15, P-16, later milestones). Owner decision.
4. Run 1 of the journey was only partly cold and the live-call count of a production request is not observable from the response or from the evidence file; M3-05 (observability) is the owner of making this measurable.
5. The extra full walk saw 5 `/cities` POSTs for 4 cities (one repeat, likely the page re-read or a retry); not investigated.

## Not verified

A human first-run stopwatch; a real production 429; the live Qloo call count of the production journey; LLM ceiling through a route; behaviour behind Vercel's real `x-vercel-forwarded-for`; ui-reviewer on deployed M2 pages.

## Addendum 2026-10-27: gate closed

- **Step 9 re-walked after PR #72** (functions pinned to `sin1`, one read per page; details in `docs/evidence/m2-06-cold-start.md`). Production `/s/sample-berlin-electronic`, curl total time from one client in Mumbai: after more than 8 minutes idle **1.72 s**, then 0.22 s and 0.31 s; first request on the new deployment 1.37 s, then 0.54, 0.28, 0.48 s; Leipzig 0.21 s and 0.22 s after idle. Before the fix: 4.30 s and 4.00 s after idle. Two post-fix cold samples, one client location: a thin margin under the 2 s target. The keep-warm workflow is skipped while the repo is private; the owner's uptime monitor on `/api/health?deep=1` is the warm-up until then.
- **Prerequisites:** `check-prereqs` reports 18/18 ready (P-06, P-13, P-15, P-16 completed by the owner on 2026-10-27).
- **Still unverified:** a real production 429, the LLM ceiling through a route (M3-01), behaviour behind Vercel's own forwarded-IP header, a human stopwatch run of the core journey.
