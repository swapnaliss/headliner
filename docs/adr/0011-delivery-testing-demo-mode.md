# ADR 0011: Fixtures-replay tests and a zero-key DEMO_MODE

Status: Accepted (2026-10-24, owner Approval 2)

## Context
R9, R10; judges and CI must run from a clean clone; Qloo keys are deactivated after judging.

## Decision
npm workspaces, Vitest, GitHub Actions with dependency cache, MIT licence. Fixtures recorded in M0-02 are replayed in tests. DEMO_MODE=fixtures needs no database, LLM or Qloo key. Host deploys from Git. Version fallback to the previous minor is time-boxed to 30 minutes.

## Alternatives rejected
Terraform (two resources only).

## Consequences / cost to reverse
Low.
