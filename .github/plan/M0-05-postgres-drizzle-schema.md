---
title: "M0-05 · Postgres and Drizzle schema"
milestone: "M0 · Recon & Bootstrap"
labels: ["backend", "infra"]
blocked_by: ["M0-01"]
estimate: "2h"
resources: ["DEPLOY"]
needs: []
---

## Context

Technological Implementation and reliability (R3, R6, ADR 0002, 0006, 0007, 0008) rest on a shared Postgres store: the Qloo cache that protects the unknown quota, the 30-day shareable slates, and per-IP budgets that make a public free demo safe. Serverless instances share no memory, so this must exist before the adapter (M1-01) and budgets (M2-05). `DEMO_MODE=fixtures` must still run with no database, so the connection is lazy and optional.

## Scope

1. **Drizzle schema** in `packages/slates/src/db/schema.ts` (module owning persistence, ADR 0001), matching `docs/architecture.md` section 5:
   - `qloo_cache(key text primary key, json jsonb not null, expires_at timestamptz not null)` plus an index on `expires_at`;
   - `slates(id text primary key, json jsonb not null, created_at timestamptz not null default now(), expires_at timestamptz not null)` plus an index on `expires_at`;
   - `budgets(ip_hash text not null, day date not null, qloo_calls int not null default 0, llm_tokens int not null default 0, primary key (ip_hash, day))`.
2. **Migrations** with drizzle-kit under `packages/slates/drizzle/`, scripts `npm run db:generate` and `npm run db:migrate`, applied idempotently.
3. **Connection** `packages/slates/src/db/client.ts`: a lazy Neon-compatible Postgres client from `DATABASE_URL` (serverless driver), connect timeout and statement timeout set, returning a typed error `DatabaseUnavailable` when no URL is set; never logs the URL.
4. **Cache repository** `packages/slates/src/db/cacheRepo.ts`: `getCache(key)` returns the row only if not expired, `getStale(key)` returns an expired row for the stale-cache path (ADR 0007), `putCache(key, json, ttlSeconds)` upserts, `purgeExpired()` deletes expired rows. Heatmap values stored as aggregates only is enforced by the caller type, documented here.
5. **Cache read/write test** `packages/slates/test/cacheRepo.test.ts`: runs against a real Postgres when `DATABASE_URL` is set (write, read hit, expiry miss, stale read, upsert overwrite, purge) and against a local ephemeral Postgres when absent (for example `@electric-sql/pglite` as a dev dependency, same SQL), so CI and a clean clone need no secret. Includes a test that with no `DATABASE_URL` the client throws `DatabaseUnavailable` rather than crashing at import.
6. **Wiring**: `DATABASE_URL` added to `apps/web/src/env.ts` as optional, required only when `DEMO_MODE` is not `fixtures`; a `GET /api/health?deep=1` branch reports `db: "ok" | "unavailable" | "skipped"` without printing any connection detail; set `DATABASE_URL` in the host environment (value supplied by the owner in the console).
7. Run the migration against the Neon database once and record the table list (names only) in `docs/evidence/db-migration.md`.

## Out of scope

- The Qloo adapter's use of the cache (M1-01), slate persistence logic (M2-04), budget logic (M2-05).
- Backups beyond the host default, and any Redis tier (ADR 0006 trigger).
- Storing any personal data; `ip_hash` is a salted hash, never the IP.

## Acceptance Criteria

- [ ] `npm run db:generate` produces no diff after the committed migration (schema and migration agree)
- [ ] Migration applies to an empty database and a second application is a no-op
- [ ] The cache test passes with no `DATABASE_URL` (ephemeral Postgres) and, when `DATABASE_URL` is set, against Neon
- [ ] Expired rows are not returned by `getCache` but are returned by `getStale`
- [ ] Importing the app and running `DEMO_MODE=fixtures` with no `DATABASE_URL` works; `DatabaseUnavailable` is thrown only when a query is attempted
- [ ] `/api/health?deep=1` on production returns `db: "ok"` and contains no connection string
- [ ] `docs/evidence/db-migration.md` lists the three tables; no secret value appears in any file

## Deliverables

- `packages/slates/src/db/schema.ts`, `client.ts`, `cacheRepo.ts`, `drizzle.config.ts`
- `packages/slates/drizzle/` migrations
- `packages/slates/test/cacheRepo.test.ts`
- `apps/web/src/env.ts` update, `apps/web/app/api/health/route.ts` deep check
- `docs/evidence/db-migration.md`

## Validation Gate

```bash
set -euo pipefail
npm run typecheck --silent && npm run lint --silent
# cache test, no secrets, no network (ephemeral Postgres)
env -i PATH="$PATH" HOME="$HOME" npm test --silent -- packages/slates
# schema and migration agree
npm run db:generate --silent
test -z "$(git status --porcelain packages/slates/drizzle)"
# zero-key fixtures run does not need the database
T="$(mktemp -d "${TMPDIR:-/tmp}/m0-05.XXXXXX")"
env -i PATH="$PATH" HOME="$HOME" DEMO_MODE=fixtures PORT=3124 bash -c 'npm run build --silent && (npm start & echo $! > "'"$T"'/pid"; sleep 8; curl -fsS "localhost:3124/api/health?deep=1" | jq -e ".db == \"skipped\""); kill $(cat "'"$T"'/pid")'
# production database reachable (names only, no connection detail)
URL="${HEADLINER_PROD_URL:?set HEADLINER_PROD_URL}"
curl -fsS "$URL/api/health?deep=1" | tee "$T/deep.json" | jq -e '.db == "ok"'
! grep -Eqi 'postgres(ql)?://' "$T/deep.json"
grep -q 'qloo_cache' docs/evidence/db-migration.md
./scripts/check-no-secrets.sh
```

## Handoff

- M1-01 uses `getCache`, `getStale` and `putCache` for the cache read-through and stale-cache banner.
- M2-04 adds slate persistence on the `slates` table; M2-05 builds budget logic on `budgets`; M2-03 stores heatmap aggregates in `qloo_cache`; M2-06 pins sample rooms.
- M0-GATE checks the cache test passes.
