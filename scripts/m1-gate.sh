#!/usr/bin/env bash
# Clean-clone portion of the milestone gates (M1-GATE; reused by M2-GATE and M4-GATE).
# Clones the repository fresh into $TMPDIR (no .env, no node_modules), runs it with NO keys in
# DEMO_MODE=fixtures: npm ci, typecheck, lint, tests, build, serve, POST the recorded room, check the
# Slate has Evidence and that no X-Api-Key / Qloo hostname reaches the response, server log or client
# bundle. Then gitleaks (tree + full history) and the MIT licence check on the clone.
#
# Env: M1_GATE_REPO (default: origin URL), M1_GATE_REF (default: main), M1_GATE_PORT (default 3918),
#      M1_GATE_KEEP=1 keeps the temp dir. Needs git, npm, curl, gitleaks on PATH.
#      M1_GATE_EXTRA=<script> (M2-GATE) runs that script against the running fixtures server, from the clone
#      (it gets M1_GATE_PORT and M1_GATE_WORK). M1_GATE_E2E=1 (M2-GATE) then runs the clone's Playwright suite
#      on ports M1_GATE_PORT+10 and +11, with the same empty environment.
# The server runs in its own process group (setsid) and the whole group is killed on exit, so no
# next-server is left running (BL-01 6410492710).
set -euo pipefail

TMPDIR="${TMPDIR:-/tmp}"
REPO_URL="${M1_GATE_REPO:-$(git remote get-url origin)}"
REF="${M1_GATE_REF:-main}"
PORT="${M1_GATE_PORT:-3918}"
WORK="$(mktemp -d "$TMPDIR/m1-gate.XXXXXX")"
SRV=""
stop_server() {
  kill -TERM -- "-$SRV" 2>/dev/null || true
  for _ in 1 2 3 4 5; do pgrep -g "$SRV" >/dev/null 2>&1 || break; sleep 1; done
  pgrep -g "$SRV" >/dev/null 2>&1 && kill -KILL -- "-$SRV" 2>/dev/null || true
  SRV=""
}
cleanup() {
  if [ -n "$SRV" ]; then stop_server; fi
  if [ "${M1_GATE_KEEP:-0}" != 1 ]; then rm -rf "$WORK"; else echo "m1-gate: kept $WORK"; fi
}
trap cleanup EXIT

step() { printf '\n== %s\n' "$*"; }

step "clone $REPO_URL @ $REF"
git clone --branch "$REF" "$REPO_URL" "$WORK/clone" >/dev/null 2>&1
cd "$WORK/clone"
echo "commit: $(git rev-parse HEAD)"
test ! -e .env || { echo "m1-gate: FAIL .env present in a fresh clone" >&2; exit 1; }
test ! -e node_modules || { echo "m1-gate: FAIL node_modules present in a fresh clone" >&2; exit 1; }

step "gitleaks (tree before npm ci so node_modules is not scanned, then full history)"
gitleaks detect --no-banner --redact --no-git -s . >/dev/null 2>&1 || { echo "m1-gate: FAIL gitleaks found leaks in the working tree" >&2; exit 1; }
echo "tree: no leaks"
gitleaks detect --no-banner --redact -s . >/dev/null 2>&1 || { echo "m1-gate: FAIL gitleaks found leaks in history" >&2; exit 1; }
echo "history: no leaks"

# Empty environment: only what npm/node need. No keys, no database URL.
run() { env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" NO_COLOR=1 DEMO_MODE=fixtures "$@"; }

step "npm ci";            run npm ci --no-audit --no-fund 2>&1 | tail -5
step "typecheck + lint";  run npm run typecheck 2>&1 | tail -5; run npm run lint 2>&1 | tail -5
step "tests";             run npm test -- --reporter=dot 2>&1 | tail -15
step "build";             run npm run build -w apps/web 2>&1 | tail -15

step "serve on :$PORT (fixtures, no keys)"
run PORT="$PORT" setsid npm run start -w apps/web >"$WORK/server.log" 2>&1 &
SRV=$!
up=0
for _ in $(seq 1 30); do
  if curl -sf "localhost:$PORT/api/health" >/dev/null; then up=1; break; fi
  sleep 1
done
[ "$up" = 1 ] || { tail -30 "$WORK/server.log"; echo "m1-gate: FAIL server did not start" >&2; exit 1; }
echo "health: $(curl -sf "localhost:$PORT/api/health")"

ROOM_DIR=apps/web/test/fixtures
step "POST /api/slates with the recorded room"
curl -sf -X POST "localhost:$PORT/api/slates" -H 'content-type: application/json' \
  --data "@$ROOM_DIR/room.json" >"$WORK/slate.json"
grep -q '"evidence"' "$WORK/slate.json"
grep -q '"status":"done"' "$WORK/slate.json"
echo "slate bytes: $(wc -c <"$WORK/slate.json"); evidence entries: $(grep -o '"evidence"' "$WORK/slate.json" | wc -l)"

step "key / hostname leak checks"
if grep -iE 'x-api-key' "$WORK/slate.json" "$WORK/server.log"; then echo "m1-gate: FAIL X-Api-Key in response or log" >&2; exit 1; fi
if grep -rlE 'X-Api-Key|hackathon\.api\.qloo\.com' apps/web/.next/static; then echo "m1-gate: FAIL key material or Qloo host in client bundle" >&2; exit 1; fi
echo "no X-Api-Key in response/log; no X-Api-Key or Qloo host in apps/web/.next/static"

if [ -n "${M1_GATE_EXTRA:-}" ]; then
  step "extra checks: $(basename "$M1_GATE_EXTRA")"
  run M1_GATE_PORT="$PORT" M1_GATE_WORK="$WORK" bash "$M1_GATE_EXTRA"
fi

stop_server
if [ "${M1_GATE_E2E:-0}" = 1 ]; then
  step "e2e (Playwright, fixtures, no keys) on :$((PORT + 10))"
  run E2E_PORT="$((PORT + 10))" npm run e2e -w apps/web 2>&1 | tail -45
  [ "${PIPESTATUS[0]}" = 0 ] || { echo "m1-gate: FAIL e2e" >&2; exit 1; }
fi
echo "server process group stopped; leftover next-server from this run: $(pgrep -f "$WORK" | wc -l)"

step "licence"
grep -q "MIT License" LICENSE || { echo "m1-gate: FAIL LICENSE is not MIT" >&2; exit 1; }
echo "LICENSE is MIT"

echo
echo "m1-gate: ok (clean clone, no keys)"
