# ADR 0010: Console JSON logs plus an uptime check

Status: Accepted (2026-10-24, owner Approval 2)

## Context
R1; solo 48 h.

## Decision
Structured JSON logs with run id, endpoint, latency, status, cache hit. Request params logged, never headers. External uptime check on the demo URL.

## Alternatives rejected
OpenTelemetry stack, SLO alerts (single service).

## Consequences / cost to reverse
Low.
