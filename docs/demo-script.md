# Demo video script (optional, owner-recorded)

> Aggregate affinity, not a ticket forecast.

A video is not required by the hackathon rules. This is the storyboard from `PROJECT.md` section 2 as a timed shot list with narration. The owner records and uploads it; the link goes on the M4-02 issue only, never in the repo. Target: **160 seconds** (limit 180).

Use the production site https://headliner-ai.vercel.app. Warm the sample rooms 5 minutes before recording (open both once) so the first request is not a cold one. Narration quotes no number that is not in `docs/evidence/`.

## Shot list

| # | Time | Seconds | On screen | Narration |
|---|---|---|---|---|
| 1 | 0:00 to 0:10 | 10 | Title card, then the home page with the banner | "A talent buyer at an independent venue picks acts by instinct, and a miss is an empty room. Headliner ranks candidate acts by how well each act's audience tastes fit the room's regular crowd, and shows its evidence." |
| 2 | 0:10 to 0:30 | 20 | Room setup: city Berlin, six crowd acts typed in (Apparat, Moderat, Modeselektor, Hundreds, Brandt Brauer Frick, Boys Noize), five candidates (Khruangbin, Radiohead, Reality Club, Phoenix, Sigur Ros) | "I describe the room: a city and the acts its regular crowd listens to. Then the acts I am considering. I could also write one sentence and let the agent fill this in." |
| 3 | 0:30 to 0:45 | 15 | Press "Rank these acts"; show the match confirmation step | "Names are matched to real Qloo entities and I confirm each match, so a wrong match cannot slip into the ranking." |
| 4 | 0:45 to 1:05 | 20 | The slate appears: ranked cards with Fit, shared tastes, popularity rank chip; the banner stays visible | "The slate is ranked by audience-taste fit. Every number is computed by code from Qloo's compare data. The model never calculates anything." |
| 5 | 1:05 to 1:25 | 20 | The "Compare with Qloo popularity rank order" panel | "Qloo popularity rank says how well known an act is. Fit says how close its audience is to my crowd. The two orders differ, and that difference is the point: popularity is not fit." |
| 6 | 1:25 to 1:50 | 25 | Open the top act: shared tastes, then expand the Evidence trail | "Open the top act: the shared tastes, and the evidence. Every number links to a redacted summary of the Qloo requests behind it: endpoint, parameters, time, what it supports. The key is never shown." |
| 7 | 1:50 to 2:10 | 20 | Nearby cities strip loads; point at a thin-data flag | "Nearby cities load on demand. Heatmap values are rescaled per city, so I compare cities by mean affinity rank and cell count, and a city with fewer than 15 cells is flagged as thin data." |
| 8 | 2:10 to 2:25 | 15 | An act with no data: the "No data" card under Not ranked | "When Qloo has nothing usable for an act, Headliner shows no number and says so, instead of guessing." |
| 9 | 2:25 to 2:40 | 15 | Closing card: live URL, repo, banner text | "Headliner: a decision tool for venue buyers, in any city, built on Qloo. Try it with no login at headliner-ai dot vercel dot app." |

Total: 10 + 20 + 15 + 20 + 20 + 25 + 20 + 15 + 15 = **160 seconds**.

Optional closing line over shot 9 if the owner wants the three-city claim: show the home-city check summary from `docs/evidence/home-city-check.md` ("12 of 15 acts, 5 cities, small hand-picked sample, three misses listed"), not a headline claim. The storyboard's "Lagos, Berlin, Jakarta" close is satisfied by showing those three rows of that table, with the sample stated.

## Showing an act with no data (shot 8)

Qloo fuzzy-matches every typed name and never says "unknown". The recorded case in `docs/evidence/m2-gate.md` (step 7) typed "Wynn Delacroix" and chose "Timothy Michael Wynn", which gave a real entity with no usable tags and the "No data" card. Rehearse it before recording; it makes live Qloo calls and counts against the per-visitor limit.

## Fallback if the live site is slow

Open a sample room from the home page (stored slate, no live call). Shots 4 to 7 work from it. Shot 2 and 3 can then show the setup screen with the sample filled in.

## Recording checklist

- [ ] Browser devtools closed; no network tab, no request headers visible at any point.
- [ ] Terminal and editor closed; `.env` and any key file not open anywhere on screen.
- [ ] No key, header value or connection string on screen. The Evidence trail shows redacted summaries only; check each frame.
- [ ] Browser bookmarks, other tabs and notifications hidden.
- [ ] Banner "aggregate affinity, not a ticket forecast" visible in shots 1, 4 and 9.
- [ ] Narration avoids the words "forecast", "turnout" and "sell" except to negate them.
- [ ] Captions (or a text version of the narration above) added for accessibility.
- [ ] Under 3 minutes (target 160 s).
- [ ] After upload (unlisted), post the link on the M4-02 issue and confirm there that no key, `.env` or header value is visible.
