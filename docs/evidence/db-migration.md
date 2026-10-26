# Database migration evidence (M0-05)

Migration `packages/slates/drizzle/0000_condemned_bloodstrike.sql` applied to the Neon database
with `npm run db:migrate` on 2026-10-26. A second run reported success and changed nothing
(drizzle records applied migrations in `drizzle.__drizzle_migrations`).

Tables in schema `public` afterwards (names only; no connection detail is recorded here):

- `budgets`
- `qloo_cache`
- `slates`

Cache test against Neon: `packages/slates/test/cacheRepo.test.ts` ran 13 of 13 passing with
`DATABASE_URL` set (8 on ephemeral Postgres plus the 5 cache cases repeated on Neon). Test rows use
a unique key prefix and are deleted afterwards.
