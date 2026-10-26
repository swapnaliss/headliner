---
title: "M3-01 · Agent intake loop: one sentence to a structured Room"
milestone: "M3 · Agent Layer & Proof"
labels: ["agent", "backend"]
blocked_by: ["M2-GATE"]
estimate: "4h"
resources: ["LLM"]
needs: [P-05]
---

## Context

Rubric: Technological Implementation and Quality of the Idea. Stage 1 asks for an agentic tool; ADR 0009 puts the LLM at the edges only. This ticket builds the first edge: a booker types one sentence ("a 200-cap venue in Leipzig, our crowd loves Khruangbin and Bonobo") and gets a structured Room that feeds the existing create-slate pipeline. The LLM never computes a number and never sees raw Qloo payloads; scoring stays code (ADR 0009, ADR 0013).

## Scope

- `packages/agent/src/intake/` (module `agent`, ADR 0001), with `runIntake(input: string, deps): Promise<IntakeResult>`.
- Bounded loop of at most 3 steps (hard constant `MAX_INTAKE_STEPS = 3`). Each step is one model turn using the OpenAI SDK (`openai`, pinned in `PROJECT.md` §4) through a thin `LlmProvider` interface, with read-only tools: `propose_matches(name)` (calls the existing Qloo adapter `/search` through the cache, returns candidate `{entity_id, name, popularity}` only) and `ask_clarification(question)` (allowed once per intake). No write tools, no network tool other than the adapter.
- Output validated by a zod schema `IntakeResultSchema` shared with `docs`/ADR 0003 contracts: `{ room: { city, crowdActs[] (max 6) , candidateActs[] (max 12) }, cities: string[] (max 5), clarification?: string, steps: number }`. Invalid output is retried within the step budget, then returns a typed `intake_failed` result.
- Input guardrails before any model call: length cap 500 chars, strip control characters, reject empty, act and city names capped at 80 chars, counts capped at 6 crowd, 12 candidates, 5 cities. Text from the user is placed in a delimited data block, never in the system prompt.
- Caps: per-run token ceiling and per-run spend ceiling constants; the per-IP and global LLM budgets from M2-05 are checked before each model turn; at the ceiling the loop stops and returns `mode: "deterministic"` so the form stays usable (ADR 0008).
- Route `POST /api/intake` with the zod request schema; DEMO_MODE=fixtures replays a recorded intake trace from `fixtures/agent/intake/*.json` with zero keys.
- Intake output is a proposal: matches still pass through the M2-01 confirmation screen, so an ambiguous match blocks ranking as before.
- Record 4 real traces (sentence in, steps, final Room) once with a live key into `fixtures/agent/intake/`, with no keys or headers in them.

## Out of scope

- Eval suite and injection corpus (M3-03).
- Explanation text (M3-02).
- Any scoring, ranking or number produced by the model.
- Chat UI beyond the existing intake field; the form remains the primary path.

## Acceptance Criteria

- [ ] `runIntake` never makes more than 3 model turns; a unit test with a stub model that keeps asking for tools stops at 3 and returns a typed result.
- [ ] A sentence naming a city and 3 acts returns a schema-valid Room in fixtures mode with no keys set.
- [ ] An under-specified sentence yields exactly one clarifying question and a second clarification attempt is refused.
- [ ] Output with 13 candidates, 7 crowd acts, 6 cities or an 81-char name is rejected or truncated per the documented limit, tested.
- [ ] Input of 501 chars, control characters and an empty string are rejected before any model call (stub asserts zero calls).
- [ ] At the spend or token ceiling the result is `mode: "deterministic"` and no further model call is made, tested with a stub budget.
- [ ] The model's tool results contain only entity_id, name and popularity; a test asserts no header, key or raw upstream error text reaches the prompt.
- [ ] Recorded traces exist in `fixtures/agent/intake/` and a `grep` for key-shaped strings finds none.

## Deliverables

- `packages/agent/src/intake/{loop.ts,schema.ts,guardrails.ts,tools.ts,prompt.ts}`
- `packages/agent/src/intake/*.test.ts`
- `apps/web/app/api/intake/route.ts`
- `fixtures/agent/intake/*.json`
- ADR 0009 amendment note if caps differ from the defaults (constants documented in `docs/architecture.md` section 7)

## Validation Gate

```bash
export DEMO_MODE=fixtures
npm run lint && npm run typecheck
npm test -- packages/agent/src/intake
OUT="${TMPDIR:-/tmp}/m3-01.json"
curl -sS -X POST http://localhost:3000/api/intake -H 'content-type: application/json' \
  -d '{"text":"200-cap venue in Leipzig, our regulars love Khruangbin and Bonobo"}' > "$OUT"
jq -e '.room.city and (.room.crowdActs|length<=6) and (.steps<=3)' "$OUT"
./scripts/check-no-secrets.sh
```

## Handoff

- M3-02 reuses the guardrail helpers and the `LlmProvider` client wrapper.
- M3-03 replays `fixtures/agent/intake/` traces and adds injection and tool-failure cases against `runIntake`.
- M4-01 documents the loop in the README architecture section.
