# M2-03 live heatmap proof

One real heatmap through the adapter (`fetchHeatmap` over `createQlooClient` with the live transport),
measured 2026-10-26T12:34:52Z with `scripts/live-heatmap-proof.mts`. Request summaries only: the
credential header is never stored, printed or shown here.

## Request (redacted summary)

| Field | Value |
|---|---|
| Endpoint | `/v2/insights` on `hackathon.api.qloo.com` |
| `filter.type` | `urn:heatmap` |
| `filter.location.query` | `Paris` |
| `signal.interests.entities` | `BAF6317A-DF94-4C90-92AE-63F86560C21B` (Khruangbin) |

Khruangbin in Paris is not among the recorded fixtures, so this is a real, uncached answer.

## Result (n = 1 live call)

| Measure | Value |
|---|---|
| HTTP status | 200 |
| Latency (one attempt, measured by the adapter) | 2,575 ms |
| Response shape assertion (`results.heatmap[]`, each cell with `location` and `query.{affinity, affinity_rank, popularity}`) | passed |
| Cells with a usable `affinity_rank` | 817 (0 dropped) |
| Mean `affinity_rank` (unrounded, then rounded by core) | 0.5660176597307228, 0.566 |
| Thin data (fewer than 15 cells) | no |
| Response digest (SHA-256 of the reduced aggregate) | `9dda6cef591021d0687b04651aee2489108c40a9238589bf505ed48d51c4717b` |

What is kept: the cell count and the mean `affinity_rank`. The grid, the coordinates and the raw
`affinity` and `popularity` values are dropped inside the adapter before caching (ADR 0002), because
Qloo rescales `affinity` and `popularity` per city and they must not be compared across cities.

## Cache read-through

The same call repeated in the same process made no second live call: the client counters were
`liveCalls: 1, cacheHits: 0` after the first call and `liveCalls: 1, cacheHits: 1` after the second.

## Live Qloo calls spent by this ticket

| Purpose | Calls |
|---|---|
| Recording candidate heatmaps for the fixtures (`scripts/qloo-record.ts heatmap-m2` and `heatmap-extra`): Khruangbin, Radiohead and Reality Club in Berlin, London, Leipzig and Jakarta (Reality Club in Jakarta was already recorded), plus Tromsø for all three; one extra Reality Club in Reykjavik probe whose file was dropped | 15 |
| This live proof | 1 |
| Total | 16 (no 429, no 5xx) |

Single run, one workstation: the latency is one sample, not a distribution. Recorded latencies of the
15 recording calls were 531 to 1,882 ms (a 200 each time).
