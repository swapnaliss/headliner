---
title: "M3-02 · Grounded explanation over structured Slate fields"
milestone: "M3 · Agent Layer & Proof"
labels: ["agent", "backend"]
blocked_by: ["M2-GATE"]
estimate: "3h"
resources: ["LLM"]
needs: []
---

## Context

Rubric: Technological Implementation and Design. A booker needs the "why" in words, but ADR 0009 forbids the model from computing or inventing numbers. This ticket builds the second edge: templated sentences over structured Slate fields, optionally smoothed by the LLM, and a grounding check that rejects any output containing a number that is not in the Slate. Wording follows the product rule: "audience-taste fit", never "forecast", "turnout" or "will sell"; standing is "Qloo popularity rank".

## Scope

- `packages/agent/src/explain/` with `buildFacts(actResult): Fact[]` (flattens fit, overlapTags, standing, cityStrengths, caveats into labelled facts), `renderTemplate(facts): string` (pure, deterministic sentences, always available) and `explainSlate(slate, deps): Promise<{text, source: "llm" | "template"}>`.
- The LLM receives only the `Fact[]` (structured fields, resolved Qloo names, no free user text) and returns JSON `{sentences: string[]}` validated by zod; it may reorder and connect facts but the prompt forbids new figures.
- `groundingCheck(text, slate)`: extracts every numeric token (integers, decimals, percentages, rank positions) and fails if any is absent from the set of numbers in the Slate (after the same rounding the UI uses). Also fails on banned words: forecast, turnout, "will sell", ticket sales, and any claim of momentum or trend.
- Deterministic fallback: if the LLM is down, times out, returns invalid JSON, fails grounding, or the spend ceiling or per-IP budget is hit (M2-05), return `renderTemplate` output with `source: "template"`. The fallback is also the path under DEMO_MODE=fixtures with no key.
- Plain-text rendering only: output is rendered as text nodes, never HTML or markdown; shared pages (M2-04) render the stored text the same way.
- Wire into the Slate page as an "Explanation" block with the source label ("written from checked facts" or "template") and the banner "aggregate affinity, not a ticket forecast" unchanged. Frontend work here is limited to adding that block to the existing slate and act detail screens built to `docs/design/screen-slate.md` and `docs/design/screen-act-detail.md`; run the ui-reviewer pass on the changed screens.

## Out of scope

- Intake (M3-01) and the eval suite (M3-03).
- Any new score, rank or metric.
- Streaming or chat-style answers.

## Acceptance Criteria

- [ ] `renderTemplate` on a recorded Slate fixture is byte-stable (snapshot test) and contains only numbers present in the Slate.
- [ ] `groundingCheck` fails on a text with an invented number ("Fit 91" when the Slate has 74), on a percentage not in the Slate, and on each banned word; passes on the template output. One test per case.
- [ ] With a stub model that returns an ungrounded number, `explainSlate` returns `source: "template"`.
- [ ] With the stub model throwing, timing out, or the budget ceiling set, `explainSlate` returns `source: "template"` and makes no further model call.
- [ ] With no LLM key and DEMO_MODE=fixtures the Slate page shows the template explanation.
- [ ] A fact containing `<script>` or markdown is rendered as literal text (component test).
- [ ] ui-reviewer pass recorded for the changed screens with no blocking findings.

## Deliverables

- `packages/agent/src/explain/{facts.ts,template.ts,grounding.ts,explain.ts,prompt.ts}` and `*.test.ts`
- `apps/web/components/Explanation.tsx` and its use on the slate and act detail pages
- `fixtures/agent/explain/*.json` (recorded model outputs, one grounded, one ungrounded)

## Validation Gate

```bash
export DEMO_MODE=fixtures
unset ANTHROPIC_API_KEY
npm run lint && npm run typecheck
npm test -- packages/agent/src/explain
OUT="${TMPDIR:-/tmp}/m3-02.json"
curl -sS http://localhost:3000/api/slates/sample-leipzig > "$OUT"
jq -e '.explanation.source=="template"' "$OUT"
grep -ciE 'forecast|turnout|will sell' "$OUT" | grep -qx 0
./scripts/check-no-secrets.sh
```

## Handoff

- M3-03 uses `groundingCheck` and `explainSlate` for trajectory and injection evals.
- M3-06 includes the Explanation block in its state and accessibility pass.
- M4-01 cites the grounding check in the honesty-layer section.
