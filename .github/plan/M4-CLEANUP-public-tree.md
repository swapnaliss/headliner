---
title: "M4-CLEANUP · Public tree: untrack the build workflow before the repo goes public"
milestone: "M4 · Submission"
labels: ["docs", "owner"]
blocked_by: ["M3-GATE", "M4-01", "M4-02", "M4-03"]
estimate: "1h"
resources: []
needs: []
---

## Context

Judges reading the public repo should see the product, its architecture and its evidence, not the
build workflow. During the build the workflow files must stay tracked, because `/start-milestone`
and `/gate` worktrees only receive tracked files. So this ticket runs **last**, after every other
build ticket and before the last gate, which then proves the public tree from a clean clone.

Files are **untracked, not deleted** (`git rm -r --cached` plus `.gitignore`), so the owner keeps
them locally. History is **never rewritten**: issues, PRs and old commits stay as the visible record
of how the product was built. Research, outreach, recon notes and review screenshots were gitignored
from day one and never entered history.

## Scope

**Untrack and gitignore:**

| Path | Why |
|---|---|
| `.github/plan/` | Ticket sources; the GitHub issues hold the same content |
| `PROJECT.md`, `WORKFLOW.md`, `CLAUDE.md` | Internal spec and workflow; the system design is public in `docs/architecture.md` |
| `.claude/commands/`, `.claude/agents/` | Workflow commands and agent instructions |
| `scripts/waves.py`, `scripts/bootstrap_github.py`, `scripts/check-prereqs.py`, `scripts/check-plan.py` | Milestone and kickoff tooling |
| `docs/engineering-standards.md`, `docs/PREREQS.md`, `docs/budget.md` | Internal standards and owner checklists (unless cited, below) |

**Keep tracked:**

- Product code, tests, IaC, CI, `README.md`, `LICENSE`, `.env.example`, `.claude/settings.json`
- `docs/architecture.md`, `docs/adr/`, `docs/design/`, `docs/evidence/`, `docs/screenshots/`
- `scripts/landing-checks.sh`, `scripts/check-no-secrets.sh` (the clean-clone check runs them)
- Any file above that a tracked file cites: list it here, or repoint the citation to the issue

**Decide and record on the issue:** anything the owner wants kept public from the untrack list.

## Out of scope

- Rewriting history or removing anything from old commits
- Making the repo public (the submit ticket, with the owner's go-ahead)

## Acceptance Criteria

- [ ] `git ls-files` lists none of the untracked paths (output on the issue)
- [ ] Every repo path cited by a tracked file is itself tracked: the citation check prints nothing
- [ ] `./scripts/landing-checks.sh` passes on a clean clone of the merge commit
- [ ] CI is green on the merge commit
- [ ] File count before and after, and the owner's decisions, posted on the issue

## Deliverables

- `.gitignore` additions and the untracking commit; any repointed citations

## Validation Gate

```bash
set -euo pipefail
INTERNAL='^(\.github/plan/|PROJECT\.md$|WORKFLOW\.md$|CLAUDE\.md$|\.claude/(commands|agents)/|scripts/(waves|bootstrap_github|check-prereqs|check-plan)\.py$|docs/(engineering-standards|PREREQS|budget)\.md$)'
if git ls-files | grep -E "$INTERNAL"; then echo "internal paths still tracked"; exit 1; fi
git ls-files | wc -l
# every repo path cited in a tracked file must itself be tracked (a local untracked copy does not count)
missing=$(git grep -hoE '(docs|scripts|infra|fixtures|\.github)/[A-Za-z0-9_./-]+\.(md|ts|tsx|js|mjs|json|ya?ml|sh|py)' \
  | sort -u | while read -r p; do git ls-files --error-unmatch -- "$p" >/dev/null 2>&1 || echo "$p"; done)
[ -z "$missing" ] || { printf 'MISSING:\n%s\n' "$missing"; exit 1; }
tmp=$(mktemp -d "$TMPDIR/cleanup.XXXX") && git clone -q . "$tmp/c" \
  && (cd "$tmp/c" && npm ci && ./scripts/landing-checks.sh)
```

## Handoff → the last gate, then the submit ticket

Comment with the merge commit SHA, the file count before and after, and the owner's decisions.
