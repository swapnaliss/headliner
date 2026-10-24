# ADR 0009: Deterministic pipeline with an LLM at the edges

Status: Accepted (2026-10-24, owner Approval 2)

## Context
Rubric: 'agentic tool' Stage 1; invariant that the LLM never computes numbers.

## Decision
Scoring is code. The LLM does (a) free-text intake into a structured room, in a bounded loop of at most 3 steps that can propose entity matches and ask one clarifying question, and (b) an explanation built from templated sentences over structured Slate fields only. Output is JSON-schema validated, plain text rendered, and a grounding check fails any number not in the Slate. Step, token and spend caps. Read-only blast radius.

## Alternatives rejected
LLM planner choosing and ranking (non-deterministic, unverifiable).

## Consequences / cost to reverse
Medium.
