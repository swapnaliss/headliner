# Production deploy

Production URL: https://headliner-ai.vercel.app

| | |
|---|---|
| Host | Vercel project `headliner`, deployed from Git on every merge to `main` (Vercel Git integration) |
| Mode | `DEMO_MODE=live` (production env, set 2026-10-26 for M1-05): hackathon Qloo host, Postgres cache, `slates` table |
| Secrets | `QLOO_API_KEY`, `DATABASE_URL`, `BUDGET_SALT` live only in the Vercel environment (set by the owner, P-12); never in the repo |
| Preview | `DEMO_MODE=fixtures` (recorded responses, in-memory store: a slate page opened on a different serverless instance than the one that made it can read as "no longer available", so use the production URL or a local run for the full flow) |
| Public access | No login, no CAPTCHA; Vercel Deployment Protection off |
| Deploy date and commit | 2026-10-26, commit `91887ae6d073f1d2c7f715ef5479af5b6c68ef1f` (merge of PR #46, M1-05), Vercel Git integration; verified live by the M1 gate (`docs/evidence/m1-gate.md`) |

Checks used by the M1-05 gate: `GET /api/health` returns 200 and `/` contains the Banner string "aggregate affinity, not a ticket forecast".
