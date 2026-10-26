---
title: "M0-01 · Repo bootstrap, CI and hello deploy"
milestone: "M0 · Recon & Bootstrap"
labels: ["infra", "backend", "critical"]
blocked_by: ["M0-00"]
estimate: "3h"
resources: ["DEPLOY"]
needs: [P-01, P-03, P-09]
---

## Context

Technological Implementation is judged on a working, reproducible build, and the Stage 1 rule requires a functional hosted demo and a public repo with a visible OSI licence. Every later ticket needs a green CI, a deploy path and a zero-key run path. This ticket proves the whole delivery chain with a trivial page before any feature code exists, so version or host problems surface in hour 3, not on Oct 30 (ADR 0011, risk register "New dependency releases").

## Scope

1. **Re-verify pinned versions** from `PROJECT.md` section 4 (Next.js, TypeScript, zod, drizzle-orm, openai, vitest) with `npm view <pkg> version time --json`, record the result and date in `docs/evidence/versions.md`, update the `PROJECT.md` table if a pin changed, then commit the lockfile.
2. **30-minute fallback rule** (ADR 0011): if `next build` or `tsc` fails on the pinned Next.js or TypeScript, spend at most 30 minutes, then step back one minor (Next.js) or to the latest 5.x (TypeScript), and record the fallback and the failure message in `docs/evidence/versions.md`.
3. **npm workspaces** layout per ADR 0001: root `package.json` with `workspaces: ["apps/*", "packages/*"]`; `apps/web` (Next.js App Router, TypeScript strict); empty-but-building packages `packages/core`, `packages/qloo`, `packages/agent`, `packages/slates` each exporting a `version` constant and a Vitest smoke test. `packages/core` must declare no dependencies (enforced later by lint).
4. **TypeScript strict** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) via `tsconfig.base.json`; ESLint flat config with `no-restricted-imports` blocking `next`, `node:*` and `pg` imports inside `packages/core`; Prettier config.
5. **Vitest** at the root (`npm test`), plus `npm run lint`, `npm run typecheck`, `npm run build`, `npm run check` (all four).
6. **GitHub Actions** `.github/workflows/ci.yml`: Node 24, `actions/setup-node` with npm dependency cache, `npm ci`, lint, typecheck, test, build, gitleaks (`gitleaks/gitleaks-action` with full history fetch), and a licence step that fails unless `LICENSE` exists and `package.json` says `"license": "MIT"`. Target PR CI at 5 minutes or less (engineering standards R9); record the observed run time.
7. **Hello page**: `apps/web/app/page.tsx` renders "Headliner" plus the banner text "aggregate affinity, not a ticket forecast"; `apps/web/app/api/health/route.ts` returns `{ ok: true, mode, version }` where `mode` is `fixtures` or `live` from `DEMO_MODE`. No secrets are read or returned.
8. **Env wiring**: `.env.example` listing variable names only (`DEMO_MODE`, `QLOO_API_KEY`, `QLOO_BASE_URL`, `DATABASE_URL`, `OPENAI_API_KEY`) with no values; `apps/web/src/env.ts` validating them with zod and requiring none of them when `DEMO_MODE=fixtures`.
9. **Deploy**: connect the repo to the host (Vercel, Git-based deploy per ADR 0011), set `DEMO_MODE=fixtures` and the variable names in the host environment (values set by the owner in the console, never in the repo), and deploy the hello page to production.
10. **README run path**: root `README.md` gets a "Run it" section: clone, `npm ci`, `DEMO_MODE=fixtures npm run dev`, `npm run check`; states that no key, database or LLM is needed in fixtures mode.
11. `scripts/check-no-secrets.sh` continues to pass.

## Out of scope

- Any Qloo, database or LLM code (M0-02, M0-05, M1).
- The real UI (M1-04, M1-05).
- Custom domain.

## Acceptance Criteria

- [ ] `docs/evidence/versions.md` lists each pinned package, the registry version and publish date checked, and any fallback taken with its reason
- [ ] `npm ci && npm run check` passes from a clean clone with no `.env` present
- [ ] `DEMO_MODE=fixtures npm run build && DEMO_MODE=fixtures npm start` serves `/` and `/api/health` returning `{"ok":true,"mode":"fixtures",...}` with no environment variables other than `DEMO_MODE`
- [ ] Importing `next` or `node:fs` from `packages/core` fails `npm run lint`
- [ ] CI is green on a PR, uses the npm cache (second run logs a cache hit), runs gitleaks and the licence check, and finishes in 5 minutes or less
- [ ] The production URL answers `GET /api/health` with HTTP 200 and `ok: true`, and the page shows the banner text
- [ ] `.env.example` contains names only; `./scripts/check-no-secrets.sh` passes
- [ ] README "Run it" section works when followed literally

## Deliverables

- `package.json`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc`, `vitest.config.ts`
- `apps/web/` (Next.js skeleton, `app/page.tsx`, `app/api/health/route.ts`, `src/env.ts`)
- `packages/core`, `packages/qloo`, `packages/agent`, `packages/slates` skeletons
- `.github/workflows/ci.yml`, `.env.example`, `README.md` (Run it section)
- `docs/evidence/versions.md`

## Validation Gate

```bash
set -euo pipefail
T="$(mktemp -d "${TMPDIR:-/tmp}/m0-01.XXXXXX")"
git clone --quiet . "$T/clone" && cd "$T/clone"
env -i PATH="$PATH" HOME="$HOME" bash -c 'npm ci --no-audit --no-fund && npm run check'
test -f docs/evidence/versions.md
grep -q '"license": "MIT"' package.json
! grep -Eq '=.+' .env.example
# zero-key run path
env -i PATH="$PATH" HOME="$HOME" DEMO_MODE=fixtures PORT=3123 bash -c 'npm run build && (npm start & echo $! > "'"$T"'/pid"; sleep 8; curl -fsS localhost:3123/api/health | jq -e ".ok == true and .mode == \"fixtures\""; curl -fsS localhost:3123/ | grep -q "aggregate affinity, not a ticket forecast"); kill $(cat "'"$T"'/pid")'
# lint boundary
echo 'import "node:fs";' > packages/core/src/_boundary.ts
! npm run lint --silent && echo "boundary enforced"
rm packages/core/src/_boundary.ts
# production deploy
cd - >/dev/null
URL="$(jq -r '.production_url // empty' .github/plan/resources.json 2>/dev/null || true)"
[ -n "$URL" ] || URL="${HEADLINER_PROD_URL:?set HEADLINER_PROD_URL to the production URL}"
curl -fsS "$URL/api/health" | jq -e '.ok == true'
./scripts/check-no-secrets.sh
```

## Handoff

- M0-02 and M0-05 build inside this workspace layout and use `.env.example`, `apps/web/src/env.ts` and the CI workflow.
- M0-GATE checks the production hello deploy responds.
- M1-01 to M1-05 depend on the workspace packages, strict config, lint boundary and the README run path.
