# ADR 0006: Stateless tier, cache as the scaling lever

Status: Accepted (2026-10-24, owner Approval 2)

## Context
R2, R3.

## Decision
App tier is stateless serverless. Scaling arithmetic: one slate is at most 6 crowd + 12 candidate resolves + 12 compares = 30 Qloo calls (assumed, validated in M0-02); city detail adds up to 5 heatmap calls per act opened. 5,000 slates a week (100x) = 150k uncached calls; at a 70% cache hit about 45k.

## Alternatives rejected
Redis tier (trigger: DB cache p95 above 50 ms).

## Consequences / cost to reverse
Low.
