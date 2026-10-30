# Fit on few shared tastes: one production observation

Source for the README Honest limits bullet "Fit can read high on few shared tastes". One observation (n=1), not a rate.

## What was run

- When: 2026-10-30, slate created 11:35 UTC on production (https://headliner-ai.vercel.app, live mode), read back from the stored slate page the same day.
- Room: Portland, entered as one sentence (a folk club), read by the intake agent into 5 crowd acts (Bon Iver, Fleet Foxes, Sufjan Stevens, Phoebe Bridgers, Father John Misty) and 4 candidates.

## What the slate showed

| Rank | Act | Fit | Shared tastes | Qloo popularity rank (crowd median 99.9) |
|---|---|---|---|---|
| 1 | Dua Lipa | 72.9 | 8 | 99.8 |
| 2 | Big Thief | 59.7 | 94 | 99.1 |
| 3 | Adrianne Lenker | 58.9 | 85 | 98.2 |
| 4 | Skrillex | 58.0 | 43 | not recorded here |

The top act shared 8 tastes with the crowd and the runner-up shared 94. Fit is the mean Qloo tag score over the shared tags (ADR 0013), so a small shared set can average high. The slate prints the shared-taste count beside Fit.

## Limits

- One room, one run, hand-entered acts. How often this happens is not measured.
- The only overlap caveat in the product is for a single shared tag; there is no minimum-overlap rule.
- The slate's share link is not recorded here. The per-call request summaries are on the slate's Evidence section (12 calls for the top act).
