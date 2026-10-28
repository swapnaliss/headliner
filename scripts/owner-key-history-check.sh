#!/usr/bin/env bash
# OWNER-RUN ONLY (M4-03). Proves the local credentials never entered git history, the tracked tree or the screenshots.
#
# Usage, from the repo root, in your own terminal (or from Claude Code as an owner command):
#     ! bash scripts/owner-key-history-check.sh
#
# It reads QLOO_API_KEY, OPENAI_API_KEY and DATABASE_URL from the repo-root `.env` into shell variables
# (parsed as text, never sourced or exported), then prints ONLY a name and an integer count per place:
#   history      lines in `git log -p --all` that contain the value
#   tracked-tree matches in files git tracks right now
#   screenshots  matches in the printable text of docs/screenshots/* (includes PNG text chunks)
# Expected output: 0 everywhere. It never prints, logs or writes a value; the value is handed to grep through a
# file descriptor (grep -f <(printf ...)), so it is not in any process argument list either. Agents must not run it.
set -u
set +x
umask 077

cd "$(git rev-parse --show-toplevel)" || exit 2

# Refuse when stdout is a regular file: the output is safe on a terminal or a pipe, but should not be redirected into
# a file that could later be committed.
if [ -f /dev/stdout ] && [ ! -t 1 ]; then
  echo "refusing to run: stdout is a regular file. Run it on your terminal or pipe it (| cat)." >&2
  exit 2
fi
[ -r .env ] || { echo "no readable .env in the repo root" >&2; exit 2; }

# Reads NAME=value from .env as text. Strips one pair of surrounding quotes. Never evaluates the line.
get() {
  local line value
  line=$(grep -E "^[[:space:]]*(export[[:space:]]+)?$1=" .env | tail -n 1) || return 1
  value=${line#*=}
  value=${value%$'\r'}
  case $value in
    \"*\") value=${value#\"}; value=${value%\"} ;;
    \'*\') value=${value#\'}; value=${value%\'} ;;
  esac
  printf '%s' "$value"
}

fail=0
for name in QLOO_API_KEY OPENAI_API_KEY DATABASE_URL; do
  value=$(get "$name") || value=""
  if [ -z "$value" ]; then
    echo "$name: not set in .env (nothing to check)"
    continue
  fi
  history=$(git log -p --all 2>/dev/null | grep -cF -f <(printf '%s\n' "$value"))
  tree=$(git grep -hoF -f <(printf '%s\n' "$value") 2>/dev/null | wc -l | tr -d ' ')
  shots=0
  if compgen -G "docs/screenshots/*" >/dev/null; then
    shots=$(cat docs/screenshots/* 2>/dev/null | strings -a 2>/dev/null | grep -cF -f <(printf '%s\n' "$value"))
  fi
  echo "$name: history=$history tracked-tree=$tree screenshots=$shots"
  [ "$history" = 0 ] && [ "$tree" = 0 ] && [ "$shots" = 0 ] || fail=1
  unset value
done

if [ "$fail" = 0 ]; then echo "RESULT: 0 everywhere"; else echo "RESULT: NONZERO count above. Rotate that credential, then tell the agent (do not paste the value)."; fi
exit "$fail"
