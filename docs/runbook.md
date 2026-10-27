# Runbook

How to see that the demo is up, how to read what a production run did, and what to do when it is not. Decision record: ADR 0010 (console JSON logs plus an uptime check). No tracing stack, no dashboards, no log shipping.

Demo URL: `https://headliner-ai.vercel.app`. Nothing here needs a key; no token or credential is written in this file.

## Monitoring

### The health endpoint

`GET /api/health` answers `{ "ok": true, "mode": "live" | "fixtures", "version": "..." }` and touches nothing else.
`GET /api/health?deep=1` adds `"db": "ok" | "skipped" | "unavailable"` from a `select 1`. If the database does not answer, the deep check returns HTTP **503** with `"ok": false`, so a monitor that checks only the status code still alerts. It never returns a connection string, a host or driver text. It also keeps the Neon compute awake, which matters for the first visitor after a quiet spell (docs/evidence/m2-06-cold-start.md).

### Signal 1: external monitor (UptimeRobot)

| Item | Value |
|---|---|
| Service | UptimeRobot, free plan |
| Monitor name | `headliner-health` (**confirm with the owner**: the exact name was not passed on; correct it here once checked) |
| Type | HTTP(s) |
| URL | `https://headliner-ai.vercel.app/api/health?deep=1` |
| Interval | 5 minutes |
| Alert target | email (type only; the address is not recorded here) |
| Credentials | none in the repo; the monitor is configured in the UptimeRobot console |

Console path: UptimeRobot dashboard -> Monitors -> `headliner-health` -> edit (URL, interval) and Alert Contacts (email). A monitor that is paused or has no alert contact attached shows no alert: check both when verifying. Every 5-minute ping also holds the Neon compute and a warm function, which stands in for the keep-warm workflow while the repo is private.

### Signal 2: repo-owned scheduled check (`.github/workflows/uptime.yml`)

An independent second signal: every 10 minutes it requests `/api/health?deep=1` (two attempts, 20 s timeout) and fails on a non-200 or on `ok` not true. It uses no secrets and makes no Qloo calls.

**It does not run while the repo is private.** The job carries `if: github.event_name == 'workflow_dispatch' || github.event.repository.private == false`, the same guard as `keepwarm.yml`. A private repo has about 2,000 free Actions minutes a month; a 10-minute schedule is about 4,300 billable minutes (each run rounds up to one minute), and would stall CI. A skipped job is not billed, so the schedule does nothing until the repo is public (public repos run for free). A manual run always goes ahead: Actions tab -> Uptime -> Run workflow (or `gh workflow run uptime.yml`). Until the repo is public, the external monitor is the only automatic signal.

### Checking it (M3-GATE)

1. `curl -fsS https://headliner-ai.vercel.app/api/health?deep=1` returns `ok: true` and `db: "ok"`.
2. UptimeRobot shows `headliner-health` Up, interval 5 minutes, with an email alert contact.
3. Run the Uptime workflow by hand and confirm it is green.

## Reading the logs

Every request writes JSON lines to stdout, one per event. They carry only: `runId`, `endpoint`, `latencyMs`, `status`, `cacheHit`, parameter **names** (never values), a budget decision, a fixed error code and call counts. They never carry a header, the API key, a request body, an address, a caught error's message or an upstream response body. Test: `apps/web/test/log.test.ts` (canary key in env and headers, a secret-looking upstream body, a throwing transport).

Line kinds (`kind`):

- `route`: one per API request. `endpoint` is the route pattern (for example `POST /api/slates`), `status` the HTTP status, `cacheHit` true when Qloo data was served only from the cache, `budget` is `allow`, `cache_only` or `deny` for metered routes, `errorCode` the API error code on a 4xx or 5xx. `qloo` appears when the request touched Qloo: `upstreamCalls` (transport attempts, retries included, the same count the budget settles), `retries`, `status429` (attempts Qloo answered with 429), `cacheHits`, `staleServed`, `failures`.
- `qloo`: one per Qloo event inside that request. `endpoint` is the Qloo path, `params` the parameter names, `latencyMs` and `status` of the attempt, `cacheHit`. A retry line has `errorCode` `retry_<kind>`; a failure line has the adapter error kind.
- Guard lines from the budget (`budget_deny`, `budget_global_qloo`, `budget_llm_degraded`, `budget_store_error`) are separate JSON lines with route and reason only. `level: "error"` lines (`create_slate_failed` and similar) carry `event`, `kind` and the same `runId`.

All lines of one request share its `runId`. The total number of Qloo calls a run made is `qloo.upstreamCalls` on its route line, which answers "how many Qloo calls did that production slate cost, and were any retried or rate limited" (the slate response itself deliberately gives no such count).

Where to read them: Vercel dashboard -> project `headliner` -> Logs (Runtime Logs). Filter by the text `"kind":"route"` for one line per request, then search a `runId` to see its Qloo lines. CLI alternative: `vercel logs <deployment-url>` (needs the owner's login). Vercel keeps runtime logs for a short period on the free plan, so copy the lines you need into an evidence file.

Useful searches in the console: `"status429"` with a value above 0 (rate limiting happened), `"retries"`, `"budget":"deny"` (a visitor hit the daily limit), `"errorCode":"upstream_unavailable"`.

## When the demo is down

1. Open the monitor email or the UptimeRobot dashboard; note the time and the HTTP status.
2. `curl -sS -o /dev/null -w "%{http_code}\n" https://headliner-ai.vercel.app/api/health`. Shallow 200 with deep 503 means the database is unreachable (Neon console: project status, compute, quota). Both failing means the deployment: Vercel dashboard -> Deployments -> the latest production deployment and its build logs; promote the previous good deployment if the latest is bad.
3. If only slate creation fails, read the route lines for `errorCode` and `qloo.status429` (Qloo rate limit) and `budget` (daily limit). Saved sample rooms and stored slates read the database only and keep working while Qloo is down.
4. Record what happened and the fix in `docs/evidence/`.

## Known limits of this baseline

- Previews run `DEMO_MODE=fixtures` and `/s/sample-*` returns 500 there (`fixtures/qloo not found`): the recorded fixtures live outside the project's Root Directory (`apps/web`) and are not in the preview function bundle. Production (live mode) is not affected. Tracked on the backlog (BL-01).
- Vercel runtime logs are short-lived and unindexed beyond text search; there is no alerting on log content, only on the health endpoint.
