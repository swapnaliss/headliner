#!/usr/bin/env bash
# M3-GATE check 4: the deterministic fallback with the LLM budget forced to zero, proven LOCALLY on a production
# build (DEMO_MODE=live) against the THROWAWAY test database only (TEST_DATABASE_URL, P-14). Not run on production.
#
# The model key is deliberately a dummy ("sk-invalid-..."): a call that reached OpenAI would fail as `llm_error`,
# so seeing `reason: "budget"` and `fallback: "budget"` proves the guard answered BEFORE any model call, and costs 0.
# A control server (default budgets, same dummy key) must show the call WAS attempted (`llm_error`/`error`), which
# proves the zero-budget result is the budget and not a missing key.
#
# Env: M3_GATE_TREE (a built checkout, default repo root), M3_GATE_ENV_FILE (variables file, default <tree>/.env;
#      sourced silently, never printed), M3_GATE_PORT (default 3410), M3_GATE_OUT (log dir).
# Live Qloo spend: one cold-ish room of 3 + 3 acts (at most 9 calls; cached names cost 0).
set -uo pipefail
TREE="${M3_GATE_TREE:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$TREE" || exit 1
PORT="${M3_GATE_PORT:-3410}"
OUT="${M3_GATE_OUT:-${TMPDIR:-/tmp}/m3-gate-fallback.$$}"
mkdir -p "$OUT"
SRV=""
stop_server() {
  [ -n "$SRV" ] || return 0
  kill -TERM -- "-$SRV" 2>/dev/null || true
  for _ in 1 2 3 4 5; do pgrep -g "$SRV" >/dev/null 2>&1 || break; sleep 1; done
  pgrep -g "$SRV" >/dev/null 2>&1 && kill -KILL -- "-$SRV" 2>/dev/null || true
  SRV=""
}
trap stop_server EXIT

set -a; . "${M3_GATE_ENV_FILE:-./.env}"; set +a
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL (P-14) is required}"
[ "${DATABASE_URL:-}" != "$TEST_DATABASE_URL" ] || { echo "refusing: TEST_DATABASE_URL equals DATABASE_URL" >&2; exit 1; }
export DATABASE_URL="$TEST_DATABASE_URL"
export DEMO_MODE=live BUDGET_SALT="m3-gate-test-salt" OPENAI_API_KEY="sk-invalid-m3-gate-dummy"
echo "database in use: throwaway test branch (TEST_DATABASE_URL); production DATABASE_URL not used; model key: dummy"
(cd packages/slates && npm run db:migrate >/dev/null 2>&1) && echo "test database migrated"

start() { # $1 = log name, rest = env assignments
  local log="$OUT/$1.log"; shift
  env "$@" PORT="$PORT" setsid npm run start -w apps/web >"$log" 2>&1 &
  SRV=$!
  for _ in $(seq 1 40); do curl -sf "localhost:$PORT/api/health" >/dev/null && return 0; sleep 1; done
  tail -20 "$log"; echo "server did not start" >&2; exit 1
}
ROOM='{"city":"Hamburg","crowdActs":["Radiohead","Portishead","Massive Attack"],"candidateActs":["Khruangbin","Bonobo","Four Tet"]}'
SENT='{"text":"We run a small club in Hamburg and our regulars like Radiohead, Portishead and Massive Attack. Compare Khruangbin, Bonobo and Four Tet."}'
post() { curl -s -X POST "localhost:$PORT$1" -H 'content-type: application/json' -H 'x-forwarded-for: 203.0.113.77' --data "$2" -w '\nHTTP %{http_code}'; }

phase() { # $1 label, $2 log name, rest = env
  local label="$1" name="$2"; shift 2
  echo; echo "== $label"
  start "$name" "$@"
  echo "-- POST /api/intake (sentence not in the recorded traces; live mode)"
  post /api/intake "$SENT" | tee "$OUT/$name-intake.txt" | cut -c1-400
  echo "-- POST /api/slates (live Qloo)"
  post /api/slates "$ROOM" >"$OUT/$name-create.txt"
  tail -1 "$OUT/$name-create.txt"
  local id; id="$(head -1 "$OUT/$name-create.txt" | jq -r '.id // empty')"
  echo "slate id present: $([ -n "$id" ] && echo yes || echo no)"
  echo "-- GET /api/slates/<id> (explanation)"
  curl -s -H 'x-forwarded-for: 203.0.113.77' "localhost:$PORT/api/slates/$id" | tee "$OUT/$name-expl.json" | jq -c '{source: .explanation.source, text_head: (.explanation.text[0:90])}'
  stop_server
  echo "-- server log events ($name):"
  grep -h -E '"event":"(llm_|budget_)|"kind":"llm"' "$OUT/$name.log" | sed 's/"runId":"[0-9a-f]*",\?//' | sort | uniq -c | sed 's/^/   /'
  echo "   llm_usage lines (a model call that returned usage): $(grep -c '"event":"llm_usage"' "$OUT/$name.log")"
}

phase "Phase 1: LLM budget forced to zero (BUDGET_GLOBAL_LLM_TOKENS=0 BUDGET_IP_LLM_TOKENS=0)" zero BUDGET_GLOBAL_LLM_TOKENS=0 BUDGET_IP_LLM_TOKENS=0
phase "Phase 2: control, default budgets, same dummy key (the call must be attempted and fail)" control

echo; echo "== key / header checks on both server logs and responses"
cat "$OUT"/*.log "$OUT"/*.txt "$OUT"/*.json >"$OUT/all.txt"
echo "x-api-key (case-insensitive): $(grep -ciE 'x-api-key' "$OUT/all.txt")"
echo "dummy model key value: $(grep -cF 'sk-invalid-m3-gate-dummy' "$OUT/all.txt")"
echo "raw test address: $(grep -cF '203.0.113.77' "$OUT/all.txt")"
echo; echo "m3-gate-fallback: done (logs in $OUT)"
