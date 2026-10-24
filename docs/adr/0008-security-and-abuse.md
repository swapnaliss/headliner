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
