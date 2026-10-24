#!/usr/bin/env bash
# The landing checks: ONE chain shared by /start Phase 6 and /start-milestone § 3d, so a manager's
# merge and a worker's merge are held to the same bar. The first failure stops the rest, and the
# secret scan runs first so a leak blocks landing exactly like a failed test.
# Edit per project (add its own checks at the bottom), never per run.
#
# Two levels:
#   ./scripts/landing-checks.sh          full: every workspace plus the slow project checks.
#                                        Standalone /start, the /start-milestone batch gate, CI.
#   ./scripts/landing-checks.sh --fast   only the npm workspaces this branch changed against
#                                        origin/main. /start-milestone workers, and re-runs after a
#                                        rebase or backlog fix. A root config change runs everything.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
FAST=0
[ "${1:-}" = "--fast" ] && FAST=1

# Private-from-day-one paths (research, outreach, recon notes, review screenshots, local state) are
# gitignored by /kickoff and must never be tracked. Workflow files are untracked later, by M<n>-CLEANUP.
if git ls-files | grep -E '^(docs/(research|outreach|recon)/|\.review/|\.prp/|\.dev-refs\.md$|\.kickoff-state\.md$)'; then
  echo "landing-checks: the private paths above are tracked; run 'git rm -r --cached' on them" >&2
  exit 1
fi

./scripts/check-no-secrets.sh

# Prints "ALL", or the changed workspace locations separated by spaces (empty when none changed).
changed_workspaces() {
  local base
  base=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null) || { echo ALL; return; }
  CHANGED="$(git diff --name-only "$base"; git ls-files --others --exclude-standard)" node -e '
    // Workspaces from package.json, not `npm query` (which needs node_modules). Supports literal
    // paths and one trailing `/*`, the shapes npm workspaces use in practice.
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const globs = Array.isArray(pkg.workspaces) ? pkg.workspaces : (pkg.workspaces?.packages ?? []);
    const ws = globs.flatMap((g) => {
      if (!g.endsWith("/*")) return fs.existsSync(`${g}/package.json`) ? [g] : [];
      const dir = g.slice(0, -2);
      return fs.existsSync(dir)
        ? fs.readdirSync(dir).map((d) => `${dir}/${d}`).filter((p) => fs.existsSync(`${p}/package.json`))
        : [];
    });
    if (ws.length === 0) { console.log("ALL"); process.exit(0); }
    const hit = new Set();
    for (const f of process.env.CHANGED.split("\n").filter(Boolean)) {
      const w = ws.find((l) => f === l || f.startsWith(l + "/"));
      if (w) hit.add(w);
      else if (/^(package(-lock)?\.json|tsconfig[^/]*\.json|eslint\.config\.[cm]?js|\.eslintrc[^/]*)$/.test(f)) {
        console.log("ALL"); process.exit(0);
      }
    }
    console.log([...hit].join(" "));
  ' 2>/dev/null || echo ALL
}

if [ -f package.json ]; then
  scope=ALL
  [ "$FAST" = 1 ] && scope=$(changed_workspaces)
  if [ "$scope" = ALL ]; then
    npm run typecheck
    npm run lint
    npm run test
  elif [ -z "$scope" ]; then
    echo "landing-checks --fast: no workspace changed; npm checks skipped"
  else
    for w in $scope; do
      echo "landing-checks --fast: $w"
      npm run typecheck -w "$w" --if-present
      npm run lint -w "$w" --if-present
      npm run test -w "$w" --if-present
    done
  fi
else
  echo "landing-checks: no package.json yet (before the repo-bootstrap ticket): npm checks not applicable"
fi

# Project-specific checks below. Guard a check that a later ticket creates with `if [ -x … ]; then …; fi` (never `[ … ] && …`: a false test as the last command fails the script) and say so.
# Put slow checks (emulators, e2e, full-stack runs) inside `if [ "$FAST" = 0 ]; then … fi`.

# Headliner: the key and the build workflow's private paths must never be tracked or shipped.
if git ls-files | grep -E '^(\.env($|\.(local|production|development))|\.dev-refs\.md$|\.kickoff-state\.md$)' ; then
  echo "landing-checks: a private file is tracked"; exit 1
fi
if [ -f package.json ] && [ -f scripts/check-fixtures.mjs ]; then
  node scripts/check-fixtures.mjs
else
  echo "landing-checks: scripts/check-fixtures.mjs not present yet (created by M0-02): fixture check skipped"
fi
# Slow: the zero-key DEMO_MODE=fixtures smoke test (created by M1-03).
if [ "$FAST" = 0 ]; then
  if [ -x scripts/demo-mode-smoke.sh ]; then ./scripts/demo-mode-smoke.sh; else echo "landing-checks: demo-mode smoke not present yet (M1-03)"; fi
fi
