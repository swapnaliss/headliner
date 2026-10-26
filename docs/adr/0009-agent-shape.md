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

## Update 2026-10-26
Owner decision: the LLM provider is OpenAI, not Anthropic, because of cost (BL-01, owner ticket M3-01). The decision above is unchanged: scoring is code, the LLM never computes or invents a number, input to the model is structured fields only, output is schema-validated and grounding-checked, and a deterministic template fallback is used whenever the model is unavailable, over budget or ungrounded. What changes: the SDK is `openai` (version in `PROJECT.md` §4), the secret is `OPENAI_API_KEY`, and the model is set by `LLM_MODEL`, which the owner picks against OpenAI's current pricing page before M3-01 (no model or price is recorded here). The total budget stays 6 USD with a 5 USD provider-side hard limit. The LLM stays behind a thin provider interface in the `agent` module (one `complete`-style function taking structured input and a zod output schema), so the provider can change again without touching the pipeline, the guardrails or the fallback; cost to reverse stays medium to low.
