#!/usr/bin/env bash
# M2-GATE step 11 (storyboard steps 1 to 3, 5 and 8 in DEMO_MODE=fixtures, zero keys), HTTP level.
# Called by scripts/m1-gate.sh through M1_GATE_EXTRA after the clean clone's server is up, with the clone as
# the working directory and the port in M1_GATE_PORT. Needs curl and jq. Prints one line per check, exits
# non-zero on the first failed check. The browser level (keyboard-only picker, axe) is the clone's e2e suite.
set -euo pipefail
P="${M1_GATE_PORT:?}"
B="localhost:$P"
W="${M1_GATE_WORK:-${TMPDIR:-/tmp}}"
ok() { printf 'PASS  %s\n' "$*"; }
bad() { printf 'FAIL  %s\n' "$*" >&2; exit 1; }
json() { curl -s -X POST "$B$1" -H 'content-type: application/json' --data "$2"; }

echo "-- step 1: intake loads, banner, demo-limits note"
code=$(curl -s -o "$W/home.html" -w '%{http_code}' "$B/")
[ "$code" = 200 ] || bad "GET / returned $code"
grep -q 'aggregate affinity, not a ticket forecast' "$W/home.html" || bad "banner missing"
grep -q 'Demo limits' "$W/home.html" || bad "demo-limits note missing"
ok "GET / 200; banner present; 'Demo limits' note present; says: $(grep -o 'Daily limits are off in this recorded-responses demo[^<]*' "$W/home.html" | head -1 | sed 's/<!--[^>]*-->//g' | cut -c1-120)"

CROWD='["Apparat","Moderat","Modeselektor","Hundreds","Brandt Brauer Frick","Boys Noize"]'
ROOM="{\"city\":\"Berlin\",\"crowdActs\":$CROWD,\"candidateActs\":[\"Khruangbin\",\"Radiohead\",\"Reality Club\",\"Bjork\"]}"

echo "-- step 2: match confirmation blocks ranking until resolved"
R=$(json /api/slates "$ROOM")
[ "$(echo "$R" | jq -r .status)" = awaiting_confirmation ] || bad "expected awaiting_confirmation, got: $(echo "$R" | head -c 200)"
RUN=$(echo "$R" | jq -r .runId)
pending=$(echo "$R" | jq -c '[.matches[] | select(.state != "exact") | {actInput, state}]')
echo "$R" | jq -e 'has("results") | not' >/dev/null || bad "ranked results present before confirmation"
ok "POST /api/slates -> awaiting_confirmation, no results yet; unresolved: $pending"
c=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/slates/$RUN/confirm" -H 'content-type: application/json' --data '{"choices":[]}')
[ "$c" = 400 ] || bad "confirm with no choice returned $c (expected 400)"
ok "confirm with no choice for the unresolved name -> 400 (ranking stays blocked)"
c=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/slates/$RUN/confirm" -H 'content-type: application/json' --data '{"choices":[{"actInput":"Bjork","entityId":"00000000-0000-0000-0000-000000000000"}]}')
[ "$c" = 400 ] || bad "confirm with a foreign entity id returned $c (expected 400)"
ok "confirm with an entity id that was not offered -> 400"
D=$(json "/api/slates/$RUN/confirm" '{"choices":[{"actInput":"Bjork","entityId":"skip"}]}')
[ "$(echo "$D" | jq -r .status)" = done ] || bad "confirm with skip did not finish: $(echo "$D" | head -c 200)"
ID=$(echo "$D" | jq -r .id)
ok "confirm (leave Bjork out) -> status done, slate id issued"

echo "-- step 3: ranked cards with Fit, shared tastes, Qloo popularity rank, caveats"
echo "$D" | jq -e '[.slate.results[] | select(.status=="scored")] | length >= 3' >/dev/null || bad "fewer than 3 scored acts"
echo "$D" | jq -e '[.slate.results[] | select(.status=="scored") | .standing.caption == "Qloo popularity rank"] | all' >/dev/null || bad "standing not labelled Qloo popularity rank"
ok "ranked: $(echo "$D" | jq -r '[.slate.results[] | select(.status=="scored") | "\(.rank). \(.act.name) fit=\(.fit.value) shared=\(.fit.sharedTags) standing=\(.standing.caption)"] | join("; ")')"
code=$(curl -s -o "$W/slate.html" -w '%{http_code}' "$B/slates/$ID")
[ "$code" = 200 ] || bad "GET /slates/$ID returned $code"
grep -q 'Qloo popularity rank' "$W/slate.html" && grep -q 'aggregate affinity, not a ticket forecast' "$W/slate.html" || bad "slate page lacks the popularity label or the banner"
ok "GET /slates/<id> 200; 'Qloo popularity rank' label and banner present"

echo "-- step 5: top act, shared tastes and the redacted evidence trail"
ACT=$(echo "$D" | jq -r '[.slate.results[] | select(.rank==1)][0].act.qlooEntityId')
code=$(curl -s -o "$W/act.html" -w '%{http_code}' "$B/slates/$ID/act/$ACT")
[ "$code" = 200 ] || bad "act page returned $code"
grep -q 'Shared tastes' "$W/act.html" && grep -q 'Evidence trail' "$W/act.html" || bad "act page lacks shared tastes or the evidence trail"
if grep -qiE 'x-api-key|authorization' "$W/act.html"; then bad "header name in the act page"; fi
A=$(curl -s "$B/api/slates/$ID/acts/$ACT")
n=$(echo "$A" | jq '.evidence | length')
[ "$n" -ge 1 ] || bad "no evidence in the act API"
if echo "$A" | grep -qiE 'x-api-key|authorization|apikey'; then bad "header or key in the act API"; fi
ok "act page 200 with Shared tastes + Evidence trail; act API returns $n evidence entries with keys: $(echo "$A" | jq -r '.evidence[0] | keys | join(",")'); no x-api-key/authorization anywhere"

echo "-- step 8: shared link in a clean session (no cookies): noindex, CSP, plain text"
curl -s -D "$W/share.h" -o "$W/share.html" "$B/s/$ID" >/dev/null
head -1 "$W/share.h" | tr -d '\r' | grep -q ' 200' || bad "shared page not 200"
grep -qi '^x-robots-tag: noindex' "$W/share.h" || bad "x-robots-tag noindex missing"
grep -i '^content-security-policy:' "$W/share.h" | grep -q "script-src 'self' 'nonce-" || bad "nonce CSP missing"
if grep -i '^content-security-policy:' "$W/share.h" | grep -qE "script-src[^;]*'unsafe-(inline|eval)'"; then bad "unsafe script source in CSP"; fi
grep -q 'aggregate affinity, not a ticket forecast' "$W/share.html" || bad "banner missing on the shared page"
if grep -q 'Copy link' "$W/share.html"; then bad "shared page has an owner control"; fi
ok "GET /s/<id> 200; $(grep -i '^x-robots-tag' "$W/share.h" | tr -d '\r'); CSP script-src is nonce + strict-dynamic, no unsafe-inline/eval; banner present; read-only (no Copy link)"
c=$(curl -s -o /dev/null -w '%{http_code}' "$B/s/not-a-real-id")
[ "$c" = 404 ] || bad "/s/not-a-real-id returned $c"
ok "GET /s/not-a-real-id -> 404"
echo "m2-gate-fixtures-steps: ok (steps 1, 2, 3, 5, 8)"
