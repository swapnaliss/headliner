# Headliner: Devpost text

Live demo: https://headliner-ai.vercel.app

Source: https://github.com/swapnaliss/headliner (MIT licence, see About)

> Aggregate affinity, not a ticket forecast. Everything below describes what is built and deployed, with the evidence file for each measured number. The text is written to be pasted into Devpost by the owner (M4-SUBMIT).

## Project name

Headliner

## Tagline

Rank an independent venue's candidate acts by how well each act's audience tastes fit the room's regular crowd, with the Qloo evidence one click away from every number.

## Inspiration

An independent venue's talent buyer usually judges fit by instinct, and a miss is an empty room. That pain is an inference from vendor writing on booking, not something we measured (`PROJECT.md` section 2, marked unverified there). Qloo's taste data describes audiences in aggregate, which is the right grain for a decision about a room rather than a person. We wanted a decision tool for the buyer, not a consumer recommender: show the ranking, show why, and say plainly where the data is thin or missing.

## What it does

A buyer describes the room (a city and 3 to 6 acts its regular crowd listens to), either by typing it or by writing one sentence that an agent turns into the same fields. They add candidate acts (3 to 12), confirm which Qloo entity each name matched, and get a slate:

- Ranked cards, each with **Fit** (the mean Qloo tag score shared between the act's audience and the crowd, 0 to 100, computed by code), the top shared tastes and their count, **audience standing** (a Qloo popularity rank, labelled as that, shown against the crowd's median) and caveats.
- A side-by-side of Fit order against Qloo popularity-rank order, so the buyer sees where the two disagree.
- An act page with the evidence trail: every number links to a redacted summary of the Qloo requests behind it (endpoint, parameters, time fetched, response digest, what it supports). The API key is never stored or shown.
- Nearby-city strength loaded on demand, compared by mean affinity rank and heatmap cell count, with a thin-data flag when fewer than 15 cells back a city.
- An honest empty state for an act Qloo has nothing usable for: no number is shown.
- A read-only share link for a slate, and two pinned sample rooms that open with one click and no input.

Every screen carries the banner "aggregate affinity, not a ticket forecast". The product says nothing about sales, attendance or any individual.

## How we built it

- **Qloo REST adapter** (`packages/qloo`, ADR 0012). Endpoints used in the product: search (resolve names to entities), insights compare (shared tags between the crowd and each candidate, and popularity), and the heatmap (city strength). Parameters are built from typed objects, the response shape is asserted on every call (Qloo returns 200 for invalid parameters, so a 200 proves nothing), every call has a timeout, and responses are cached in Postgres. The trending endpoint is wired in the adapter but is flat in the hackathon environment, so no part of the product claims momentum.
- **Fit formula** (ADR 0013): computed in a framework-free core package from the compare response. The LLM never computes or invents a number.
- **Agent at the edges** (ADR 0009): an LLM (OpenAI, behind a thin provider interface) turns one sentence into a room, in at most 3 steps, and phrases an explanation from fields of the computed slate. A grounding check compares the prose with the slate, and a deterministic template is the fallback. Slate-scope prose was accepted from one recorded reply (n=1); act-scope prose currently falls back to the template unless a later change says otherwise. At a daily budget ceiling the app falls back to the template and to deterministic intake instead of calling the model.
- **Fixtures**: tests and `DEMO_MODE=fixtures` replay recorded real Qloo responses. There is no synthetic data in the product path.
- **Stack**: TypeScript, Next.js, zod, Drizzle on Neon Postgres, Vitest, Playwright, deployed on Vercel. Total planned spend ceiling 6 USD (`docs/budget.md`); recorded LLM spend at the M3 gate was about 0.0077 USD (`docs/evidence/m3-gate.md`).
- **Safety**: no personal data is collected or sent to Qloo; the hackathon key is used only server-side against `hackathon.api.qloo.com`; entity names from Qloo and from the model are untrusted and rendered as plain text; per-visitor and global daily limits are enforced server-side.

## Challenges

- **Qloo ignores bad parameters silently.** A wrong parameter still returns 200, so shape assertions on every response and typed parameter objects were needed from the first call.
- **Heatmap values are rescaled per city**, so raw affinity cannot be compared across cities. Cities are compared by mean affinity rank plus cell count, and thin data is flagged (ADR 0013).
- **Trending is flat in the hackathon environment**, so there is no momentum feature, and audience standing is a popularity rank, not a venue-capacity fit.
- **Latency.** The first request to a pinned sample room after idle took 3.24 s at the M2 gate. The cause was the function region sitting far from the Neon database; moving functions next to it and removing a duplicate read brought one measurement to 1.72 s (`docs/evidence/m2-06-cold-start.md`, `docs/evidence/m2-gate.md`).
- **Keeping the model honest.** Prose is only phrasing of Slate fields and is checked; the checks have known gaps, listed below.

## Accomplishments

Measured results, each with its sample and evidence file. None is a pass or fail grade; the samples are small.

- **Home-city check: 12 of 15 acts** have their home city as the strongest city by mean affinity rank. The strict reading (home city has at least 15 cells and is highest among such cities) is also 12 of 15. Sample: 15 acts, 5 cities (London, Berlin, Lagos, Jakarta, Seoul), 3 continents, 3 acts per city, hand-picked before any heatmap was requested. Misses: BTS, BLACKPINK and IU (Seoul), where Jakarta ranked higher. Caveats: Qloo rescales per city, popularity may influence the result, and a home city is not where an act's listeners live. Evidence: `docs/evidence/home-city-check.md`.
- **Fit sanity: 11 of 12** same-genre candidates scored above their crowd's off-genre control (electronic 4 of 4, hip-hop 4 of 4, jazz 3 of 4). Sample: 3 crowds, 12 candidates, hand-picked. Margins are small (jazz from -0.2 to +0.8 points, hip-hop +0.4 to +1.3, electronic +1.3 to +4.0), which is why the slate tells the buyer to treat neighbouring ranks as close. Evidence: `docs/evidence/fit-sanity.md`.
- **Agent evals: 106 cases, 1,391 assertions, 0 failed**, run offline on recorded traces with no key (`npm run eval:agent`). They test the guardrails (input limits, typed Qloo parameters, schema-validated output, names must come from the booker's sentence, the grounding check and the fallback), not that a model will never misbehave. Known gaps, measured by probing: a lowercase invented act name, and a real Slate figure attached to the wrong meaning, are not caught by the grounding check. Evidence: `docs/evidence/agent-evals.md`.
- **Accessibility**: an automated sweep of 28 screen states at 360 and 1280 px in light and dark and a keyboard journey test pass; an axe run over 168 captures found no serious or critical issue. These are automated checks; a screen reader pass was not done (`docs/evidence/ui-review-m3.md`, `docs/evidence/m3-gate.md`).
- **Timings, with their limits.** Sample rooms read a stored slate and make no Qloo call. From one client in Mumbai, production sample-room requests took 1.72 s once after more than 8 minutes idle (two cold samples in all, one location) and 0.22 to 0.54 s warm (`docs/evidence/m2-gate.md`). One production slate from one sentence (n=1, names already cached, so not a cold-slate measurement) answered in 3.89 s for intake and 0.47 s for the slate (`docs/evidence/m3-gate.md`). A cold slate on production was not measured.

## What we learned

- With a data source that returns 200 on bad input, the adapter's response assertions are the real contract.
- Compressed scores need honest presentation: lead with rank, say when values are close, and show the popularity order next to the Fit order rather than hiding the difference.
- Letting code own every number and the model only phrase checked fields makes the agent testable offline, and the checks' gaps measurable.
- Reporting small samples as small, with the misses listed, was more useful to us than a headline percentage.
- An accepted engineering limitation: a slate viewed through both the API and the page can trigger a second explanation model call, because the explanation cache is per process. In the M3 gate production run this was a second call of about 0.000126 USD (`docs/evidence/m3-gate.md`, n=1). We note it as a cost observation, not a claim about typical use.

## What's next

From the product spec (`PROJECT.md` section 11), not built: season-long programming plans, multi-venue circuits, a shared view for artists and agents choosing tour cities, and other live categories such as comedy and sports. Near-term gaps we know of: act-scope prose currently falls back to the deterministic template (the model's act-level wording was rejected by the grounding check in the final recorded round, `docs/evidence/m3-gate.md`); a cold production slate and a real production rate-limit response are not measured; a screen reader pass is not done.

## Built with

TypeScript, Next.js, React, zod, Drizzle ORM, Neon Postgres, Vitest, Playwright, axe, OpenAI API (gpt-5-nano recorded for the evals; model set by `LLM_MODEL`), Qloo API (search, insights compare, heatmap), Vercel, GitHub Actions.

## Try it out

- Live demo: https://headliner-ai.vercel.app
- Source code: https://github.com/swapnaliss/headliner
- Measured results: `docs/evidence/` in the repository
- Design: `docs/design/` in the repository

## Testing instructions

No login, account, CAPTCHA or API key is needed.

1. Open https://headliner-ai.vercel.app. The banner "aggregate affinity, not a ticket forecast" is at the top of every screen.
2. **One-click path.** Choose a sample room (Berlin electronic club or Leipzig indie hall). It opens a stored slate built from real Qloo responses with no input and no live call. The first request after the site has been idle can take a few seconds.
3. Open the top act: shared tastes, the nearby-city strength, and the Evidence trail (redacted request summaries; no key is ever shown).
4. **Your own room.** Back on the home page, type a city and 3 to 6 crowd acts and 3 to 12 candidate acts, or write one sentence describing the room, then "Rank these acts". Confirm any ambiguous matches. A cold room calls Qloo live and takes longer than a sample.
5. **Demo limits.** Live Qloo calls and model calls are capped per visitor and per day to protect the free quotas. At the cap the page says so, and the explanation falls back to a fixed template with no model call.
6. **Run it yourself with zero keys.** Clone the repository, `npm ci`, then `DEMO_MODE=fixtures npm run dev` from the repository root. This replays recorded Qloo responses with no keys, no database and no model, so rooms outside the recordings show a "not in the recordings" state. Offline checks: `npm test`, `npm run eval:agent`, `npm run proof`.

## Gallery images (`docs/screenshots/`)

Captured on 28 Oct 2026 from the production site, https://headliner-ai.vercel.app (live mode, light mode): `/s/sample-berlin-electronic` for the slate, its Reality Club act page for the act detail, plus the room setup page and the match confirmation. No demo badge is shown. Only `empty-state-390.png` and `empty-state-1280.png` come from a `DEMO_MODE=fixtures` build (no no-data act is stored on production).

1. `docs/screenshots/slate-1280.png`: the ranked slate with the popularity-order comparison and thin-data flags (desktop).
2. `docs/screenshots/act-detail-1280.png`: act detail with shared tastes and the evidence trail (desktop).
3. `docs/screenshots/slate-390.png`: the slate on a phone.
4. `docs/screenshots/act-detail-390.png`: act detail on a phone.
5. `docs/screenshots/slate-768.png` and `docs/screenshots/act-detail-768.png`: tablet width, optional.
6. `docs/screenshots/slate-360.png` and `docs/screenshots/act-detail-360.png`: narrowest width tested, optional.

Suggested captions: "Slate: Fit, shared tastes, Qloo popularity rank and caveats per act" and "Act detail: every number links to its Qloo evidence".

## Limits and honesty notes

- Scores are computed by code. The model only phrases fields of the Slate, and the prose is checked by a grounding check with a deterministic template fallback. This text quotes no model-written sentence.
- A slate viewed through both the API and the page can trigger a second explanation model call (about 0.000126 USD, per-process cache); accepted limitation.
- Qloo trending data is flat in the hackathon environment: no momentum claims. Audience standing is a Qloo popularity rank.
- No personal data is sent to Qloo or collected.
- The measured samples above are small and hand-picked, and no accuracy claim is made from them.
