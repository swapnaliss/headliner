# Headliner

Platform: web app (TypeScript, Next.js) for the Qloo Agentic Hackathon. No blockchain, no mobile. No toolkit modules enabled.

An agent that ranks an independent venue's candidate acts and shows, with checkable Qloo evidence, how well each act's audience tastes fit the venue's regular crowd.

## Read first
`PROJECT.md` (spec) -> `docs/architecture.md` and `docs/adr/` (decisions) -> `docs/engineering-standards.md` (every ticket is built to it) -> `WORKFLOW.md` -> the ticket in `.github/plan/`.

## Workflow commands
`/status`, `/start <ticket>`, `/start-milestone <n>`, `/gate`, `/backlog`. Run `python3 scripts/waves.py <n>` before `/start-milestone`. `gh` runs outside the sandbox.

## Stack
TypeScript, Next.js, zod, Drizzle on Postgres (Neon), Vitest, OpenAI SDK for intake and explanation (behind a thin provider interface, ADR 0009 update 2026-10-26). Versions in `PROJECT.md` §4.

## Disqualifying hackathon rules
Live hosted demo free and unrestricted for judges (no login or CAPTCHA wall); public repo with an OSS licence visible in About; original work; no personal data sent to Qloo; hackathon key only against `hackathon.api.qloo.com` and never in client code, repo, logs, screenshots or recordings.

## Domain rules that are easy to get wrong
- Scores are computed by code. The LLM never computes or invents a number; it may only phrase fields from the Slate.
- Every number shown has Evidence (redacted request summary). The `X-Api-Key` header is never stored or shown.
- Qloo silently ignores invalid parameters and returns 200: assert response shape on every adapter call.
- Build Qloo params from typed objects via URLSearchParams. Never concatenate user strings.
- `/v2/trending` is flat in the hackathon environment: no momentum claims. Audience standing = Qloo popularity rank, labelled so.
- Heatmap `affinity` and `popularity` are rescaled per city: compare cities by mean `affinity_rank` plus cell count; under 15 cells = thin-data caveat.
- Wording: "audience-taste fit". Never "will sell", "turnout" or "forecast". Banner "aggregate affinity, not a ticket forecast" on every screen.
- `DEMO_MODE=fixtures` must always run with zero keys, no DB, no LLM.
- Third-party strings (entity names) are untrusted: render plain text only.

## Architecture rules
See `docs/engineering-standards.md` §4 and the ADRs. Domain core imports no framework or I/O. Every outbound call has a timeout. Authorization and limits are enforced server-side.

## Data policy
Real Qloo responses only; tests replay recorded fixtures; no synthetic data in the product path; no personal data collected.

## UI/UX
Build to `docs/design/`. Every `frontend` ticket passes the `ui-reviewer` agent.

## Claims discipline
No claim in README or UI without a measured source in the repo. Report measured numbers with their sample.

## Standing approvals
Approved by the owner on 2026-10-25 (M0-00): merge green PRs (squash, this repo, CI green); Vercel preview and production deploys of this project; live Qloo calls within hackathon quota; npm installs from the lockfile (`npm ci`). Allow rules are in `.claude/settings.json`. Anything else still asks.

## STRICT RULE: `.env`
Never read, print, cat, grep, or paste `.env` values or `~/.config/qloo/key`. Check presence with `python3 scripts/check-prereqs.py`. Credential locations are in `.dev-refs.md`.

## Hot files
`package.json`, `package-lock.json`, `docs/adr/`, `.env.example`, route registry. Resolve additive conflicts at merge.

## Never
Commit secrets; rewrite history; make the repo public without the owner; add a Claude co-author line to commits; cut or defer a feature because of time.
