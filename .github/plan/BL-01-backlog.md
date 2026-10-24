---
title: "BL-01 · Backlog: bugs, gaps, pitfalls and constraints found during the build"
milestone: "M4 · Submission"
labels: ["meta"]
blocked_by: []
estimate: "0.5h"
resources: []
needs: []
---

This issue is the running backlog. It is never closed during the build. Findings are logged as comments with `/backlog <what you found>` so a ticket in flight is not derailed. Never delete an entry.

## Why it exists

Entries are fixed ticket by ticket in `/start` Phase 7b (best effort, before merge, never blocks the merge) and swept after every passed milestone gate (`/gate` step 8). What remains at submission is triaged by `M4-01` into the README's Honest limits section and the Future vision. A limitation found and stated is a strength; the same limitation found by a judge is a hole.

## Entry format

Each entry is one comment, posted by `gh issue comment <BL-01 number> -R <repo> --body ...`:

```
### <YYYY-MM-DD HH:MM> · found in <TICKET-ID> · <type>
**What:**        <one line>
**Impact:**      <what breaks or is at risk>
**Workaround:**  <what we did instead, or "none — deferred">
**Action:**      <fix now | fix before submission | accept as limitation | document in HLD>
**Owner ticket:** <ticket id whose scope it belongs to, or "this ticket">
**Status:** open
```

- **Type**, exactly one of: `bug`, `gap`, `pitfall`, `constraint`, `assumption-wrong`, `perf`, `security`, `data-quality`.
- **Found in** is the ticket named by the current branch (`git branch --show-current`).
- **Owner ticket** is the ticket whose scope the finding belongs to, or `this ticket`.
- **Status** starts as `open` and is changed in place by editing the comment (`gh api -X PATCH repos/<repo>/issues/comments/<id>`) to one of: `fixed in #<pr>`, `deferred → <ticket> (<blocker>)`, `accepted limitation (<reason>)`.

## Triage rule

- Blocks the current ticket's acceptance criteria: fix it now, and still log it here.
- Breaks a later ticket: log it here and post a `blocker` comment on that ticket so a future session sees it before starting.
- Neither: log and defer; do not touch it.

## Do not

- Do not fix findings mid-implementation unless they block the current AC.
- Do not log vague notes ("perf could be better"); a finding must be specific enough to triage.
- Do not delete an entry.
- If a finding invalidates something in `PROJECT.md`, correct `PROJECT.md` in the same commit as the current ticket's work.

## Validation

```bash
# the issue number is in the map; the last entry must carry the two tracking lines
n=$(python3 -c "import json;print(json.load(open('.github/plan/issue-map.json'))['BL-01'])")
gh issue view "$n" --comments --json comments -q '.comments[].body' | grep -c '^\*\*Owner ticket:\*\*'
gh issue view "$n" --comments --json comments -q '.comments[].body' | grep -c '^\*\*Status:\*\*'
```
