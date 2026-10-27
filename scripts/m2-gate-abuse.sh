#!/usr/bin/env bash
# M2-GATE step 10 (abuse protection), proven LOCALLY on a production build in live mode, against the
# THROWAWAY test database only (TEST_DATABASE_URL, P-14). Production is never written and no 429 is
# provoked on the deployed host.
#
# Needs: a built app (npm run build), the repo-root env file reachable as ./.env (variables are loaded with
# `set -a; .` and never printed), gitleaks not needed. The real Qloo key is used (live mode); each phase
# spends a handful of live Qloo calls (phase A about 9, phase B 0 from cache).
#
# Phase A: per-IP limit (BUDGET_IP_QLOO_CALLS=12): same IP denied with a clean 429, fresh IPv4 and IPv6
#          not blocked, stored slate still readable for the denied IP.
# Phase B: global ceiling (BUDGET_GLOBAL_QLOO_CALLS=4): cached room served with 0 live calls, an uncached
#          room refused with the daily-limit answer and no live call.
# Phase C: guard-level checks that no route exercises yet: LLM ceiling -> deterministic_only, store down.
# Then: no raw address in server logs or any table; no key in logs.
set -euo pipefail
cd "$(dirname "$0")/.."
SCRATCH="${M2_GATE_SCRATCH:-${TMPDIR:-/tmp}/m2-gate-abuse.$$}"
mkdir -p "$SCRATCH"
PORT_A="${M2_GATE_PORT_A:-3218}"
SRV=""
stop_server() {
  [ -n "$SRV" ] || return 0
  kill -TERM -- "-$SRV" 2>/dev/null || true
  for _ in 1 2 3 4 5; do pgrep -g "$SRV" >/dev/null 2>&1 || break; sleep 1; done
  pgrep -g "$SRV" >/dev/null 2>&1 && kill -KILL -- "-$SRV" 2>/dev/null || true
  SRV=""
}
trap stop_server EXIT

# Load variables silently; then point the app at the throwaway database only.
set -a; . ./.env; set +a
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL (P-14) is required}"
[ "${DATABASE_URL:-}" != "$TEST_DATABASE_URL" ] || { echo "refusing: TEST_DATABASE_URL equals DATABASE_URL" >&2; exit 1; }
export DATABASE_URL="$TEST_DATABASE_URL"
export DEMO_MODE=live BUDGET_SALT="m2-gate-test-salt"
DBTOOL=(node node_modules/tsx/dist/cli.mjs scripts/m2-gate-db.mts)
echo "database in use: throwaway test branch (TEST_DATABASE_URL); production DATABASE_URL not used"
(cd packages/slates && npm run db:migrate >/dev/null 2>&1) && echo "test database migrated"

start() { # $1 = log name, rest = env assignments
  local log="$SCRATCH/$1.log"; shift
  env "$@" PORT="$PORT_A" setsid npm run start -w apps/web >"$log" 2>&1 &
  SRV=$!
  for _ in $(seq 1 40); do curl -sf "localhost:$PORT_A/api/health" >/dev/null && return 0; sleep 1; done
  tail -20 "$log"; echo "server did not start" >&2; exit 1
}
post() { # $1 ip, $2 json file  -> prints status, saves headers/body
  curl -s -D "$SCRATCH/h.txt" -o "$SCRATCH/b.json" -w '%{http_code}' -X POST "localhost:$PORT_A/api/slates" \
    -H 'content-type: application/json' -H "x-forwarded-for: $1" --data @"$2"
}
cat >"$SCRATCH/r1.json" <<'EOF'
{"city":"Hamburg","crowdActs":["Radiohead","Portishead","Massive Attack"],"candidateActs":["Khruangbin","Bonobo","Four Tet"]}
EOF
cat >"$SCRATCH/r2.json" <<'EOF'
{"city":"Hamburg","crowdActs":["Daft Punk","Justice","Kavinsky"],"candidateActs":["Moderat","Apparat","Modeselektor"]}
EOF

echo; echo "== Phase A: per-IP limit 12 live Qloo calls/day (room planned cost 9)"
"${DBTOOL[@]}" reset
start phaseA BUDGET_IP_QLOO_CALLS=12
echo "A1 IP-1 room R1 (cold, live): HTTP $(post 203.0.113.10 "$SCRATCH/r1.json") status=$(jq -r '.status // .error.code' "$SCRATCH/b.json") id=$(jq -r '.id // empty' "$SCRATCH/b.json")"
SLATE_ID="$(jq -r '.id // empty' "$SCRATCH/b.json")"
"${DBTOOL[@]}" budgets
echo "A2 IP-1 room R2 (planned 9, would exceed 12): HTTP $(post 203.0.113.10 "$SCRATCH/r2.json")"
echo "   response headers:"; grep -iE '^(HTTP|retry-after|cache-control|content-type)' "$SCRATCH/h.txt" | tr -d '\r' | sed 's/^/     /'
echo "   response body: $(cat "$SCRATCH/b.json")"
echo "A3 IP-2 (fresh IPv4) room R1: HTTP $(post 203.0.113.11 "$SCRATCH/r1.json") status=$(jq -r '.status // .error.code' "$SCRATCH/b.json")"
echo "A4 IPv6 2001:db8:aaaa:1::7 room R1: HTTP $(post 2001:db8:aaaa:1::7 "$SCRATCH/r1.json") status=$(jq -r '.status // .error.code' "$SCRATCH/b.json")"
echo "A5 IP-1 again (still denied): HTTP $(post 203.0.113.10 "$SCRATCH/r2.json") code=$(jq -r '.error.code' "$SCRATCH/b.json")"
echo "A6 denied IP-1 reads the stored slate: /slates/<id> HTTP $(curl -s -o /dev/null -w '%{http_code}' -H 'x-forwarded-for: 203.0.113.10' "localhost:$PORT_A/slates/$SLATE_ID"), /s/<id> HTTP $(curl -s -o /dev/null -w '%{http_code}' -H 'x-forwarded-for: 203.0.113.10' "localhost:$PORT_A/s/$SLATE_ID")"
echo "A7 malformed junk X-Forwarded-For maps to the shared 'unknown' bucket, not a fresh one:"
for i in 1 2 3; do echo "   junk-$i HTTP $(post "not-an-ip-$i" "$SCRATCH/r2.json") code=$(jq -r '.status // .error.code' "$SCRATCH/b.json")"; done
"${DBTOOL[@]}" budgets
stop_server

echo; echo "== Phase B: global ceiling BUDGET_GLOBAL_QLOO_CALLS=4 (cache-only Qloo)"
"${DBTOOL[@]}" reset
before="$("${DBTOOL[@]}" cachecount)"
start phaseB BUDGET_IP_QLOO_CALLS=150 BUDGET_GLOBAL_QLOO_CALLS=4
echo "B1 cached room R1 over the ceiling: HTTP $(post 203.0.113.20 "$SCRATCH/r1.json") status=$(jq -r '.status // .error.code' "$SCRATCH/b.json") (served from cache, no live call)"
cat >"$SCRATCH/r3.json" <<'EOF'
{"city":"Hamburg","crowdActs":["Aphex Twin","Autechre","Boards of Canada"],"candidateActs":["Burial","Kode9","Actress"]}
EOF
echo "B2 uncached room R3 over the ceiling: HTTP $(post 203.0.113.21 "$SCRATCH/r3.json")"
echo "   response headers:"; grep -iE '^(HTTP|retry-after)' "$SCRATCH/h.txt" | tr -d '\r' | sed 's/^/     /'
echo "   response body: $(cat "$SCRATCH/b.json")"
after="$("${DBTOOL[@]}" cachecount)"
echo "   cache rows before/after phase B: $before / $after (equal means no live call was cached)"
"${DBTOOL[@]}" budgets
grep -c 'budget_global_qloo' "$SCRATCH/phaseB.log" | sed 's/^/   server log lines with event budget_global_qloo: /'
stop_server

echo; echo "== Phase C: guard-level ceilings (LLM is not wired to a route until M3-01)"
"${DBTOOL[@]}" guard

echo; echo "== Raw address and key checks"
cat "$SCRATCH"/phaseA.log "$SCRATCH"/phaseB.log >"$SCRATCH/all.log"
echo "server log lines: $(wc -l <"$SCRATCH/all.log")"
echo "raw test addresses in server logs: $(grep -cE '203\.0\.113\.|198\.51\.100\.|2001:db8' "$SCRATCH/all.log" || true)"
echo "x-api-key in server logs (case-insensitive): $(grep -ciE 'x-api-key' "$SCRATCH/all.log" || true)"
echo "key value in server logs: $(grep -cF -- "$QLOO_API_KEY" "$SCRATCH/all.log" || true)"
echo "deny/degrade events logged (route and reason only):"; grep -h '"event":"budget_' "$SCRATCH/all.log" | sort | uniq -c | sed 's/^/   /'
"${DBTOOL[@]}" scan 203.0.113 2001:db8 198.51.100
echo; echo "m2-gate-abuse: done (logs kept in $SCRATCH)"
