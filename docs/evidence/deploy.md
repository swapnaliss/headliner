# Production deploy

Production URL: https://headliner-ai.vercel.app

| | |
|---|---|
| Host | Vercel project `headliner`, deployed from Git on every merge to `main` (Vercel Git integration) |
| Mode | `DEMO_MODE=live` (production env, set 2026-10-26 for M1-05): hackathon Qloo host, Postgres cache, `slates` table |
| Secrets | `QLOO_API_KEY`, `DATABASE_URL`, `BUDGET_SALT` live only in the Vercel environment (set by the owner, P-12); never in the repo |
| Preview | `DEMO_MODE=fixtures` (recorded responses, in-memory store: a slate page opened on a different serverless instance than the one that made it can read as "no longer available", so use the production URL or a local run for the full flow) |
| Public access | No login, no CAPTCHA; Vercel Deployment Protection off |
| Deploy date and commit | filled in by the manager after the M1-05 merge deploy (see the M1-05 handoff on issue #13) |

Checks used by the M1-05 gate: `GET /api/health` returns 200 and `/` contains the Banner string "aggregate affinity, not a ticket forecast".
