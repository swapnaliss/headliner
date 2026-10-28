# M2-06 sample slate latency

Measured 2026-10-27 (UTC), after `scripts/prewarm-samples.ts --record-fixtures --write-db` stored the two sample slates pinned in the production Neon database.

## What was measured, and what was not

- **Measured:** `GET /s/sample-<slug>` on a production build of this branch (`next start`, `DEMO_MODE=live`) running on the developer machine and reading the **production Neon database** (`/api/health?deep=1` returned `db: ok`). Wall time per request from `curl -w %{time_total}`. The client is the same machine, so the figure includes the real database round trip to Neon but not a visitor's network or Vercel's edge.
- **Not yet measured:** the deployed production URL. The `/s/sample-<slug>` rewrite ships with this PR, so it cannot answer on production until the PR is merged and deployed. The owner should re-run the same loop against the deployed host after the merge (command at the end) and append the numbers here.

## Results (5 samples per room, seconds)

| Room | 1 (cold process) | 2 | 3 | 4 | 5 | max |
|---|---|---|---|---|---|---|
| `sample-berlin-electronic` | 1.463 | 0.151 | 0.144 | 0.262 | 0.205 | 1.463 |
| `sample-leipzig-indie` | 0.157 | 0.235 | 0.141 | 0.160 | 0.302 | 0.302 |

(A sixth request per Berlin room measured 0.141 s and a sixth per Leipzig room 0.182 s.) The one slow request is the first request after the server started (route compile and the first Neon connection); every request, including that one, is under the 2 s limit.

No Qloo call is made by these requests: they read the stored slate only. The unit test `apps/web/test/samples.test.ts` ("reads a pinned sample through the store with a transport call counter of 0") asserts a counter of 0 on the transport.

## Pre-warm run that produced the stored slates

- Two rooms, 10 candidates in all, city strength for each room's top act in the room city plus London, Leipzig, Jakarta and Tromso (the default comparison cities).
- Live Qloo calls: two passes, 52 in all, no 5xx. Pass 1 made 19 (the rest were answered by the production Postgres cache, so the recorder missed those responses). Pass 2 read from an in-memory cache only, so every call went upstream and was recorded: 33 calls (22 for the Berlin room, 11 for the Leipzig room), including 1 HTTP 429 that the adapter retried once and then succeeded. Pass 2 produced the stored slates; no new fixtures were needed after pass 1.
- Qloo cache rows written by the pre-warm have a ten-year life, the slates have `expires_at = 9999-12-31` (ADR 0002 addendum).

## Re-run against the deployed host after merge

```bash
HOST=https://<production host>
for s in $(jq -r '.[].slug' apps/web/samples/rooms.json); do
  for i in 1 2 3 4 5; do curl -s -o /dev/null -w "$s $i %{http_code} %{time_total}\n" "$HOST/s/sample-$s"; done
done
```
