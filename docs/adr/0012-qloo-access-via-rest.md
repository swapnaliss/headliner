# ADR 0012: Call Qloo through a REST adapter

Status: Accepted (2026-10-24, owner Approval 2)

## Context
The kit lists harness surfaces as supported; a serverless Next.js app cannot reliably spawn a local CLI process.

## Decision
A single adapter module wraps hackathon.api.qloo.com with X-Api-Key and typed methods named like the harness workflows (find_tags, recommend, rank, compare_audiences, where_popular). M0-04 checks whether the harness is importable as a library; the organiser question is posted to Discord; the README states the approach. If importable and equivalent, the adapter switches behind the same interface.

## Alternatives rejected
Spawning `qloo mcp` or `qloo exec` from the server.

## Consequences / cost to reverse
Low: one adapter.

## Update (2026-10-26, M0-04)
`@qloo/qloo-harness@0.1.26` is importable as an ES module (no `require`) and has an in-process direct executor, but it is a heavy terminal-agent runtime and its result envelope differs from the REST body. Verdict "importable but different"; live equivalence not checked. Status and decision unchanged: stay on REST. Evidence: `docs/evidence/harness-check.md`.
