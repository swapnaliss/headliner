# ADR 0003: REST route handlers with shared zod schemas

Status: Accepted (2026-10-24, owner Approval 2)

## Context
R6; typed boundaries.

## Decision
JSON route handlers; zod schemas shared by client and server; one error format; pagination n/a; limits: max 12 candidate acts, 6 crowd acts, 5 cities, name length 80.

## Alternatives rejected
GraphQL or RPC: no need for either.

## Consequences / cost to reverse
Low.
