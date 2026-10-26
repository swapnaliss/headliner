# Headliner

An agent that ranks the acts an independent venue is considering and shows, with checkable Qloo evidence, how well each act's audience tastes fit the venue's regular crowd.

> Aggregate affinity, not a ticket forecast.

## Problem
<!-- M4-01 fills this -->

## Solution
<!-- M4-01 fills this -->

## Why now
<!-- M4-01 fills this -->

## Architecture
See [docs/architecture.md](docs/architecture.md). Diagram: <!-- M4-01 embeds it -->

## Demo
- Live demo: <!-- M4-04 fills -->
- Screenshots: <!-- M4-01 fills -->

## Run it
Needs Node 24 or newer. No key, database or LLM is needed in fixtures mode.

```bash
git clone <this repo> && cd headliner
npm ci
DEMO_MODE=fixtures npm run dev     # http://localhost:3000
npm run check                      # lint, typecheck, test, build
```

`GET /api/health` returns `{"ok":true,"mode":"fixtures",...}`.

## Run with no keys (DEMO_MODE=fixtures)
From a clean clone, with no `.env`, no database, no Qloo key and no LLM key. Every Qloo answer is replayed from the recordings in `fixtures/qloo/`, and the server makes no outbound network calls.

```bash
git clone <this repo> && cd headliner
npm ci
export DEMO_MODE=fixtures
npm run build -w apps/web
PORT=3000 npm run start -w apps/web &            # or: npm run dev
curl -s localhost:3000/api/health                # {"ok":true,"mode":"fixtures",...}
curl -s -X POST localhost:3000/api/slates \
  -H 'content-type: application/json' \
  --data @apps/web/test/fixtures/room.json       # ranked acts, each number with its Evidence
```

`apps/web/test/fixtures/room.json` is a recorded room (Berlin, six regular-crowd acts, four candidates). An act with no recording comes back as an honest `no-data` result, never an invented one. `scripts/demo-mode-smoke.sh` runs exactly this sequence and fails on any error. Scores are aggregate audience-taste fit from Qloo data, not a ticket forecast.

## Future vision
<!-- M4-01 fills this -->

## Licence
MIT, see [LICENSE](LICENSE).
