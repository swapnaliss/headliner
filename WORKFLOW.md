# Workflow

## Where state lives
- Spec: `PROJECT.md`. Design: `docs/architecture.md`, `docs/adr/`. Standards: `docs/engineering-standards.md`.
- Work: `.github/plan/*.md` -> GitHub issues (map in `.github/plan/issue-map.json`).
- Prerequisites: `.github/plan/prereqs.json` -> `docs/PREREQS.md`; check with `python3 scripts/check-prereqs.py`.
- Private (gitignored): `docs/research/`, `docs/outreach/`, `docs/recon/`, `.review/`, `.kickoff-state.md`, `.env`, `.dev-refs.md`.

## Commands
`/status` (zero-context status and owner list), `/start <ticket>` (one ticket end to end), `/start-milestone <n>` (manager plus one worktree worker per ticket), `/gate` (milestone gate from a clean state, then a non-blocking backlog sweep), `/backlog` (log an idea against its owner ticket).

Run `python3 scripts/waves.py <n>` before `/start-milestone <n>`; it must print `Safe to spawn: YES`.

## Design review
Every `frontend` ticket passes the `ui-reviewer` agent (never the builder) before merge.

## Prerequisites rule
A ticket's first step checks its `needs:` against `check-prereqs.py`. A missing prerequisite holds only that ticket and its dependants and goes on the owner list.

## Hard rules
No secrets in git, tickets, issues or chat. No history rewrites. Scope is never cut for time. Gates run from a clean state. Judges' live demo and `DEMO_MODE=fixtures` both must work at every gate.

## Cold session resume
Run `/status`. It reads the issue map, open PRs and the last gate.

## Backlog
Every ticket runs a best-effort backlog pass before merging (`/start` Phase 7b); every passed gate spawns a post-gate sweep (`/gate` step 8). Neither blocks progress; decisions go to the owner.
