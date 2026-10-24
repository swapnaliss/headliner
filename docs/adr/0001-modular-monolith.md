# ADR 0001: Modular monolith in TypeScript on Next.js

Status: Accepted (2026-10-24, owner Approval 2)

## Context
R4, R9; one solo builder, 48 h; one failure domain.

## Decision
Modules: core (pure domain), qloo (adapter + cache), agent (LLM edges), slates (persistence), web (UI + route handlers). The core imports no framework or I/O. One deployable.

## Alternatives rejected
Separate API service (extra deploy, no different scaling profile).

## Consequences / cost to reverse
Low: modules are already separated by interface.
