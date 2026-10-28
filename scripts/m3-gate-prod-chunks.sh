#!/usr/bin/env bash
# M3-GATE check 7 (production part): fetch the client script chunks of the deployed pages and grep them, and the
# page HTML and a not-found response, for key material. Read-only GETs; no secrets involved.
# Env: DEMO_URL (default https://headliner-ai.vercel.app), M3_GATE_SLATE (a stored slate id for one extra page).
set -uo pipefail
URL="${DEMO_URL:-https://headliner-ai.vercel.app}"
W="$(mktemp -d "${TMPDIR:-/tmp}/m3-chunks.XXXXXX")"; trap 'rm -rf "$W"' EXIT
pages=("/" "/s/sample-berlin-electronic" "/s/sample-berlin-electronic/act/x")
[ -n "${M3_GATE_SLATE:-}" ] && pages+=("/slates/$M3_GATE_SLATE")
: >"$W/chunks.txt"
for p in "${pages[@]}"; do
  curl -s "$URL$p" -o "$W/page.html"
  cp "$W/page.html" "$W/page-$(echo "$p" | tr '/' '_').html"
  grep -oE '/_next/static/[^"\\ ]+\.js' "$W/page.html" >>"$W/chunks.txt" || true
done
sort -u "$W/chunks.txt" -o "$W/chunks.txt"
n=0; bytes=0
while read -r c; do
  curl -s "$URL$c" -o "$W/chunk.$n.js"; bytes=$((bytes + $(wc -c <"$W/chunk.$n.js"))); n=$((n + 1))
done <"$W/chunks.txt"
echo "client chunks fetched: $n ($bytes bytes) from ${#pages[@]} pages"
pat='X-Api-Key|x-api-key|hackathon\.api\.qloo\.com|QLOO_API_KEY|OPENAI_API_KEY|api\.openai\.com|Authorization: Bearer|sk-[A-Za-z0-9_-]{20,}'
echo "matches for key/header/host patterns in chunks: $(cat "$W"/chunk.*.js | grep -ciE "$pat" || true)"
echo "matches in page HTML: $(cat "$W"/page-*.html | grep -ciE "$pat" || true)"
echo "not-found body:"; curl -s -o "$W/nf.html" -w '  HTTP %{http_code}\n' "$URL/slates/doesnotexist123"
echo "  matches: $(grep -ciE "$pat" "$W/nf.html" || true)"
echo "bad-input API error body:"; curl -s -X POST "$URL/api/slates" -H 'content-type: application/json' --data '{"city":""}' -w '\n  HTTP %{http_code}\n'
