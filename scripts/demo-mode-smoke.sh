#!/usr/bin/env bash
# Zero-key smoke test of DEMO_MODE=fixtures (ADR 0011): builds the app, starts it with every key
# and the database URL unset, posts the recorded room and checks the response. Referenced by
# scripts/landing-checks.sh (full level) and runnable from a clean clone after `npm ci`.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

PORT="${SMOKE_PORT:-3917}"
TMP="$(mktemp -d)"
LOG="$TMP/server.log"
OUT="$TMP/slate.json"
SRV=""
cleanup() { [ -n "$SRV" ] && kill "$SRV" 2>/dev/null || true; rm -rf "$TMP"; }
trap cleanup EXIT

unset QLOO_API_KEY ANTHROPIC_API_KEY DATABASE_URL
export DEMO_MODE=fixtures

npm run build -w apps/web >"$TMP/build.log" 2>&1 || { tail -30 "$TMP/build.log"; echo "demo-mode-smoke: build failed" >&2; exit 1; }
PORT="$PORT" npm run start -w apps/web >"$LOG" 2>&1 &
SRV=$!
up=0
for _ in $(seq 1 30); do
  if curl -sf "localhost:$PORT/api/health" >/dev/null; then up=1; break; fi
  sleep 1
done
[ "$up" = 1 ] || { tail -30 "$LOG"; echo "demo-mode-smoke: server did not start" >&2; exit 1; }

curl -sf "localhost:$PORT/api/health" | grep -q '"mode":"fixtures"'
curl -sf -X POST "localhost:$PORT/api/slates" -H 'content-type: application/json' \
  --data @apps/web/test/fixtures/room.json >"$OUT"
grep -q '"evidence"' "$OUT"
grep -q '"status":"done"' "$OUT"
code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "localhost:$PORT/api/slates" -H 'content-type: application/json' -d '{"city":""}')"
[ "$code" = 400 ] || { echo "demo-mode-smoke: expected 400 for invalid input, got $code" >&2; exit 1; }
if grep -iE 'x-api-key|api[_-]?key' "$OUT" "$LOG"; then
  echo "demo-mode-smoke: a key-shaped string reached the response or the server log" >&2
  exit 1
fi
echo "demo-mode-smoke: ok (fixtures mode, no keys)"
