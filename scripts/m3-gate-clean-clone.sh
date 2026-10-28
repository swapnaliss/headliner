#!/usr/bin/env bash
# M3-GATE clean-clone run (check 1). Clones origin/main into a temp dir with no .env and no keys, then runs the
# ticket's Validation Gate block step by step in an EMPTY environment (stricter than `env -u`): npm ci, lint,
# typecheck, npm test, eval:agent, proof, then the a11y + keyboard Playwright suites (and optionally the e2e
# suite), and finally `git diff` on docs/evidence (committed reports must not change), gitleaks on the tree and
# full history, check-no-secrets. Each step prints its exit code and wall time.
#
# Env: M3_GATE_REF (default main), M3_GATE_PORT (default 3400; picker server is +1), M3_GATE_KEEP=1 keeps the dir,
#      M3_GATE_WORK=<dir> reuses an existing clone dir (skips the clone and npm ci if node_modules exists).
set -uo pipefail

TMPDIR="${TMPDIR:-/tmp}"
REF="${M3_GATE_REF:-main}"
PORT="${M3_GATE_PORT:-3400}"
REPO_URL="${M3_GATE_REPO:-$(git remote get-url origin)}"
WORK="${M3_GATE_WORK:-$(mktemp -d "$TMPDIR/m3-gate.XXXXXX")}"
cleanup() { if [ "${M3_GATE_KEEP:-0}" != 1 ]; then rm -rf "$WORK"; else echo "m3-gate: kept $WORK"; fi; }
trap cleanup EXIT

if [ ! -d "$WORK/clone/.git" ]; then
  git clone --branch "$REF" "$REPO_URL" "$WORK/clone" >/dev/null 2>&1 || { echo "clone failed"; exit 1; }
fi
cd "$WORK/clone" || exit 1
echo "commit: $(git rev-parse HEAD)"
test ! -e .env && echo ".env absent in clone: ok"

# tsx opens a unix socket under TMPDIR; a path over 107 characters fails with EINVAL, so the steps use a short one.
SHORT_TMP="${M3_GATE_SHORT_TMP:-/tmp/m3g-$(id -u)}"; mkdir -p "$SHORT_TMP"
run() { env -i PATH="$PATH" HOME="$HOME" TMPDIR="$SHORT_TMP" NO_COLOR=1 DEMO_MODE=fixtures "$@"; }
RES=()
step() { # name, cmd...
  local name="$1"; shift
  local t0=$SECONDS
  echo; echo "== $name"
  "$@"; local rc=$?
  RES+=("$name exit=$rc time=$((SECONDS - t0))s")
  echo "-- $name exit=$rc"
}

step "gitleaks tree" gitleaks detect --no-banner --redact --no-git -s .
step "gitleaks history" gitleaks detect --no-banner --redact -s .
if [ ! -d node_modules ]; then step "npm ci" run npm ci --no-audit --no-fund; fi
step "lint" run npm run lint
step "typecheck" run npm run typecheck
step "npm test" run npm test -- --reporter=dot
step "eval:agent" run npm run --silent eval:agent
step "proof" run npm run --silent proof
step "build (web, fixtures)" run npm run build -w apps/web
step "playwright a11y+keyboard" run E2E_PORT="$PORT" npx playwright test apps/web/tests/a11y apps/web/tests/keyboard --reporter=line
if [ "${M3_GATE_E2E:-1}" = 1 ]; then
  step "playwright e2e (apps/web/e2e)" run E2E_PORT="$PORT" npx playwright test apps/web/e2e --reporter=line
fi
step "check-no-secrets" run ./scripts/check-no-secrets.sh

echo; echo "== git diff docs/evidence (must be empty)"
git status --porcelain docs/evidence
git diff --stat docs/evidence
echo "-- diff lines: $(git diff docs/evidence | wc -l)"

echo; echo "== SUMMARY"
printf '%s\n' "${RES[@]}"
