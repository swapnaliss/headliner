# ADR 0004: Request-bounded pipeline, no queue

Status: Accepted (2026-10-24, owner Approval 2)

## Context
R1; all work is read-only and re-derivable.

## Decision
Create-slate runs resolve -> compare -> score inside one request with concurrency capped at 6 and maxDuration set. City strength is computed lazily on opening an act. No queue, bus, outbox or SSE; the client shows a loading state.

## Alternatives rejected
Queue + worker + outbox: nothing mutates an external system.

## Consequences / cost to reverse
Medium. Trigger to revisit: any async write to an external system.
