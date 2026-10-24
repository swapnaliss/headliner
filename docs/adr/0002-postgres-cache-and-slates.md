# ADR 0002: Postgres for cache, slates and budgets

Status: Accepted (2026-10-24, owner Approval 2)

## Context
R3 (quota protection), R5 (shareable slates). Reads favour availability (stale cache allowed); a slate write is consistent in one transaction.

## Decision
Managed Postgres (Neon free tier) with Drizzle migrations. Tables: qloo_cache(key, json, expires_at), slates(id, json, created_at, expires_at 30 days), budgets(ip_hash, day, qloo_calls, llm_tokens). Heatmap responses are stored as aggregates only, never raw grids.

## Alternatives rejected
SQLite file (not durable on serverless); key-value only (no budgets query).

## Consequences / cost to reverse
Medium.
