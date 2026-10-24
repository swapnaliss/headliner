# ADR 0013: Fit formula (Proposed; completed by M0-03)

Status: Proposed (2026-10-24, owner Approval 2)

## Context
The hero number needs a documented deterministic definition.

## Decision
Status: PROPOSED. M0-03 defines Fit from fields in recorded compare and insights responses (candidate: mean of shared-tag scores between the crowd set and the candidate) and writes the formula, edge cases and tests here. Audience standing is the candidate's Qloo popularity position against the median of the crowd acts, labelled 'Qloo popularity rank'. City strength is mean affinity_rank across heatmap cells with a thin-data flag below 15 cells.

## Alternatives rejected
LLM-scored fit.

## Consequences / cost to reverse
Low until the UI is built on it.
