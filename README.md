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

## Future vision
<!-- M4-01 fills this -->

## Licence
MIT, see [LICENSE](LICENSE).
