# M2-06 cold first request to a pinned sample room

Defect from the M2 gate: the first `GET /s/sample-berlin-electronic` on production after idle took 3.24 s; the acceptance criterion is under 2 s. Measured 2026-10-27 from one client (Mumbai, edge `bom1`); client network is included in every wall time below. No secrets appear here; only region names and timings.

## Root cause

**The functions ran in `iad1` (Washington) and the Neon database is in Singapore (`ap-southeast-1`). Every database round trip crossed the planet: 221 to 224 ms per query.** A cold sample page paid that several times:

| Component | Measured | Source |
|---|---|---|
| Function region | `iad1` (`vercel project inspect headliner`, `x-vercel-id: bom1::iad1::...`) | project setting, no `vercel.json` existed |
| Database region | Singapore: from `iad1` a `select 1` costs 221 to 224 ms warm (n = 22 queries over 6 request runs); from `sin1` it costs 3 to 5 ms (n = 12) | temporary probe route, not committed |
| New pool, first query from `iad1` | 939 and 944 ms (n = 2), i.e. about 720 ms of connection setup (a WebSocket handshake and login, several round trips) on top of one 221 ms query | probe |
| Neon compute wake after about 8.5 min idle (`sin1`, so round trips are negligible) | first query 603 ms, against 65 to 71 ms when awake (n = 3): **wake-up is about 0.53 s** | probe |
| Reads per page request | **2**: `generateMetadata` and the page each called `store.get` (counted with a temporary log: 2 per request before, 1 after) | local `next dev`, fixtures mode |

So the database alone cost a cold request roughly 720 (connect) + 2 x 221 (reads) + about 530 (wake) = about 1.7 s, and a warm one 2 x 221 = 442 ms. The rest is function cold start and render.

## Fix

1. `vercel.json` (repo root and `apps/web/`, same content) sets `"regions": ["sin1"]`: function next to the database. The root file is the one the CLI deploy honoured; the `apps/web` one alone was not applied to a CLI deploy, so both are kept, and the Git-integration preview of this branch listed its functions as `[sin1]`. No Vercel project setting or env var was changed.
2. `React.cache` around the slate read in the four slate pages (`/s/[id]`, `/s/[id]/act/[actId]`, `/slates/[id]`, `/slates/[id]/act/[actId]`): one database read per request, not two.
3. `.github/workflows/keepwarm.yml`: GET `/api/health?deep=1` (runs `select 1`, keeps Neon awake) and one sample room every 5 minutes, 10 s timeout, no secrets, no Qloo calls. GitHub's scheduler can run late, so this lowers the chance of a cold first request, it does not guarantee it. The job carries `if: github.event_name == 'workflow_dispatch' || github.event.repository.private == false`: a 5-minute schedule is about 8,640 minutes a month, over the 2,000 minute private allowance, so the scheduled run is skipped (and not billed) while the repo is private.

The nonce CSP, noindex and no-store headers, and the contents of the pinned samples are untouched.

## Before (production, `https://headliner-ai.vercel.app/s/sample-berlin-electronic`)

| Run | Idle before | Cold request (total / first byte) | Immediate second request |
|---|---|---|---|
| gate | not recorded | 3.24 s | n/a |
| 1 | 7 min | 4.304 s / 3.798 s | 1.011 s |
| 2 | 14 min | 4.003 s / 3.986 s | 0.763 s |

Earlier the same day on production, warm: sample page 1.231 s, `/api/health` 0.37 to 0.41 s, `/api/health?deep=1` 0.518 and 0.558 s warm (n = 3) and 2.166 s on the first call after a quiet spell. n = 2 cold measurements of my own, plus the gate's.

## After

Measured on the preview deployments of this branch with the temporary probe (database round trip and connection cost, which are the dominant terms). The pinned-sample route cannot answer on a preview: previews run `DEMO_MODE=fixtures`, and there the page fails with `fixtures/qloo not found` (the same on a preview built before my change; production is `DEMO_MODE=live` and never reads fixtures). That is a preview-only problem outside this defect; see Open points.

| Quantity | Before (`iad1`) | After (`sin1`) |
|---|---|---|
| Cost of one query, warm | 221 to 224 ms | 3 to 5 ms |
| First query on a new instance, Neon awake | 939 to 944 ms | 65 to 71 ms |
| First query on a new instance, Neon woken after about 8.5 min idle | not measured separately (about 1.7 s all-in) | 603 ms |
| Reads per page | 2 | 1 |
| Database share of a cold sample page | about 1.7 s | about 0.6 s (wake only), and about 0.07 s once the keep-warm holds Neon awake |
| Database share of a warm sample page | 442 ms | under 10 ms |

Expected on production after the merge: cold page about 4.0 to 4.3 s minus about 1.1 s (connect and round trips) = roughly 3 s from Mumbai with the Neon wake still included. **The keep-warm workflow is skipped while the repo is private** (it runs only once the repo is public, or by a manual `workflow_dispatch`), so until then the production cold page is expected to stay near that roughly 3 s estimate, which does not meet the 2 s criterion. A figure under 2 s would depend on keep-warm holding Neon awake (removing about 0.53 s of wake and part of the function cold start); that figure is an unmeasured estimate and no claim of it is made. Both numbers here are estimates derived from the measurements above, not measurements of the fixed production page.

## Not verifiable until after the merge (production)

- The cold and warm timings of the real pinned room page on `headliner-ai.vercel.app` under `sin1`.
- That the keep-warm schedule actually fires every 5 minutes and keeps Neon from suspending (GitHub cron is best effort). Check the workflow run list, then repeat the loop below after at least 6 minutes of no other traffic.
- Trade-off to confirm: a visitor far from Singapore now pays one longer hop from the edge to the function (one round trip, instead of several to the database). Measure from a US or European client as well if one is available.

```bash
# after merge and a >6 minute quiet spell (one cold request, then one warm)
HOST=https://headliner-ai.vercel.app
for i in cold warm; do curl -s -o /dev/null -w "$i %{http_code} total=%{time_total} ttfb=%{time_starttransfer}\n" "$HOST/s/sample-berlin-electronic"; done
```

## If the owner wants to remove autosuspend (not done here)

Neon console, project, Settings, Compute: switch off "Scale to zero" (suspend compute after inactivity). On the free plan this setting may not be changeable; a paid plan allows it. The keep-warm workflow is the code-side substitute.

## Open points

- Previews build in `DEMO_MODE=fixtures` and `/s/sample-*` returns 500 there (`fixtures/qloo not found` at runtime, so the fixture directory is not in the function bundle for a project with Root Directory `apps/web`). Not caused by this change; worth a backlog entry.
