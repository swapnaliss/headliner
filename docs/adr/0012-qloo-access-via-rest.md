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
