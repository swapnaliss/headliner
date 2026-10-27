# ADR 0008: Server-side key, shared-store budgets, hardened shared pages

Status: Accepted (2026-10-24, owner Approval 2)

## Context
R6.

## Decision
Key only in host env, never client. Params built with URLSearchParams from typed objects. Per-IP daily budget (Qloo calls, LLM tokens) in Postgres using the platform-provided client IP header; global daily ceiling fails closed to deterministic mode. No login or CAPTCHA. Shared slate ids are unguessable (nanoid 21), pages are noindex, 30-day TTL, only resolved Qloo entity names are rendered, strict CSP. Never expose raw upstream error bodies. Secret scanning (gitleaks) in CI.

## Alternatives rejected
In-memory rate limits (do not work on serverless); login wall (violates free unrestricted access).

## Consequences / cost to reverse
Low.

## Addendum (M2-05, 2026-10-27): client IP header and limits
- Header: `x-vercel-forwarded-for` (set by Vercel to the connecting address, not client-overridable), then `x-real-ip`, then the first hop of `x-forwarded-for`. Off the platform a client can send these itself, so budgets are an abuse brake, not authentication. A missing or malformed address maps to one shared bucket; IPv6 is bucketed by /64. Only a salted SHA-256 of address and UTC day is stored (`BUDGET_SALT`).
- One atomic upsert (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`) updates the visitor's row and the day's `global` row of `budgets` together. No new table or index (the primary key `(ip_hash, day)` serves it).
- Per-IP Qloo limit exceeded: 429 `demo_limit_reached` with `Retry-After` to the next UTC midnight. Global Qloo ceiling: cache only, no live call. LLM ceilings (per IP or global): `deterministic_only`. Budget store unreachable: metered work is denied; stored slates and sample rooms never touch the guard. Defaults and the sizing arithmetic are in `docs/budget.md`.
