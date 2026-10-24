# ADR 0007: Timeouts, one retry, partial results

Status: Accepted (2026-10-24, owner Approval 2)

## Context
R1, R4.

## Decision
10 s timeout per Qloo call, one retry with jitter, concurrency cap 6. A failed act shows 'no data' and the slate still renders. 429 or quota exhaustion serves stale cache with a banner. LLM down means the form and templated text still work. Response-shape assertions on every adapter call because Qloo silently ignores invalid params.

## Alternatives rejected
Circuit breaker per endpoint and full retries (too much machinery for the traffic).

## Consequences / cost to reverse
Low.
