# Headliner design: index

Design direction, system, components and the four hero-screen specs. Written for ticket M1-04; the build tickets below build to these files and the `ui-reviewer` agent reviews against them.

## Direction

Headliner is a decision tool for independent venue talent buyers, not a consumer recommender. The interface is a calm, evidence-first working document: rank first, Fit second, the Qloo evidence one click away from every number, and an honest "unavailable" or "thin data" instead of a smoothed-over gap.

Principles every screen follows:

1. **Evidence over decoration.** Every number links to the Qloo calls behind it. No hero image, gradient, emoji or decorative chart.
2. **Status is never colour alone.** Icon, label and colour together, in a colour-blind-safe palette.
3. **Calm density.** Flat bordered surfaces, tabular figures, one accent colour.
4. **Honest copy.** The wording rule is "audience-taste fit". The Banner string "aggregate affinity, not a ticket forecast" is on every screen. No momentum or growth claims (the hackathon trending data is flat). Fit is compressed, so rank leads and close values are called close. Cities are compared only by mean affinity rank and cell count, with a thin-data flag under 15 cells.
5. **Live, not refresh.** Progress is text plus a live region, never a bare spinner.
6. **Every state designed:** empty, loading, partial, error, no data, thin data, stale, offline.
7. **Every script renders correctly.** Entity names are untrusted plain text with `dir="auto"`.
8. **WCAG 2.2 AA**, mobile-first from 360px, 44px targets on mobile.
9. **No template look.**

Copy rules: plain, specific, no marketing; sentence case; verbs on buttons ("Rank these acts"); say what is missing, why, and what to do next; never "Oops"; numbers shown with their unit or caption; names always quoted from data, never invented. Words that imply a prediction of sales or attendance are never used as a claim. The validation command for this ticket greps for the banned words.

## Frontend-design skill

The `frontend-design` skill is not installed in this environment (it was not in the skill list available to the design agent), so it was not used. The rules in this folder and the principles above were applied on their own.

## Users

| User | Device and context | Language and skill | One job |
|---|---|---|---|
| Independent venue talent buyer (primary) | phone between calls, laptop at a desk, anywhere in the world | any language and script; knows artists, not data tools | decide which candidate acts deserve a closer look for the room's regular crowd |
| Promoter or festival booker | laptop; programs 4 to 12 weeks ahead | as above | compare many acts quickly and share the result with a co-programmer |
| Artist manager | phone | as above | see how an act's audience tastes fit a venue's crowd |
| Hackathon judge | laptop or phone, three minutes, no login | English; evaluating design and honesty | understand the product from the first screen and reach a slate with evidence in under three minutes |

## Files and who builds to them

| File | What it holds | Built to by |
|---|---|---|
| [design-system.md](design-system.md) | colour tokens with measured contrast (light and dark), type, spacing, radius, elevation, motion, focus ring, targets, breakpoints, status system, the single CSS token block | M1-05 (tokens.css and base styles); all later frontend tickets |
| [components.md](components.md) | Banner, Button, TextField, ActChip, ActCard, Caveat chip, EvidenceRow, SkeletonCard, EmptyState, ErrorState, MatchPicker, CityStrip, ThinDataBadge, plus ProgressStatus and ShareLinkField | M1-05 (Banner, Button, TextField, ActChip, ActCard, Caveat chip, SkeletonCard, EmptyState, ErrorState, ProgressStatus); M2-01 (MatchPicker); M2-02 (EvidenceRow); M2-03 (CityStrip, ThinDataBadge); M2-04 (ShareLinkField) |
| [screen-room-setup.md](screen-room-setup.md) | first screen: city, crowd acts, candidate acts, one-sentence intake, sample room | M1-05 (form), M2-06 (sample room), M3-01 (one-sentence intake island) |
| [screen-match-confirmation.md](screen-match-confirmation.md) | ambiguous, no-match and non-ASCII names; ranking blocked until confirmed | M2-01 |
| [screen-slate.md](screen-slate.md) | ranked ActCards, partial results, no-data acts, comparison with popularity-rank order, share link, loading progress, failed run; shared-page note | M1-05 (slate page, loading and error states), M2-04 (shared page, share link) |
| [screen-act-detail.md](screen-act-detail.md) | shared tastes, Evidence trail, lazy other-cities strip with thin-data flag | M2-02 (shared tastes, Evidence trail), M2-03 (other-cities strip), M3-02 (phrasing of "Why this Fit") |
| [accessibility.md](accessibility.md) | audit checklist | M3-06 (audit); every ticket as a self-check |
| `scripts/check-contrast.mjs` (in the repo root `scripts/`) | contrast checker for the tables in design-system.md; run with `node scripts/check-contrast.mjs docs/design/design-system.md` | M1-04 (written), M3-06 (re-run), M1-05 (token test) |

Plain-text rule for untrusted strings (components.md, "Conventions for every component"): built to by M1-05 and M2-04 and checked by accessibility item N-01.

Tickets beyond those named in the M1-04 handoff (M2-06, M3-01, M3-02) are listed by title match; the milestone plan in `.github/plan/` is the source of truth for ticket scope.

## Logical data shape the specs refer to

The specs name fields from the architecture's domain model (`docs/architecture.md` section 2) and ADR 0013. These are logical names. The zod schemas from M1-02 are the source of truth; if a name differs, the schema wins and the "Data source" section of each screen is updated.

| Object | Fields used by the specs |
|---|---|
| `Slate` | `id`, `room { city, crowdActs[], candidateActs[] }`, `acts[]` (ActResult), `fitSpread`, `popularityOrder[]`, `cityList[]` (cities offered for the other-cities strip), `generatedAt`, `expiresAt`, cache-served flag |
| `Run` | `state` (draft, matching, awaiting_confirmation, scoring, done, failed), `progress { done, total }`, per-act status, `matches[]` (`role`, `typedName`, `status` single / ambiguous / none / not-in-recordings, `hits[]`, `confirmed`) |
| `Act` | `qlooEntityId`, `name`, `matchConfidence` (single-confirmed or chosen-by-user) |
| `ActResult` | `act`, `rank`, `fit` (value 0..100 to 1 decimal, or `unavailable` reason: no-shared-tags, too-few-shared-tags, unresolved-entity, candidate-in-crowd), `overlapTags[]` (`label`, `score`, `coveredCrowdActs`), `standing` (label above, similar, below; candidatePercentile; crowdMedian; crowdSample; or `unavailable` reason), `cityStrengths[]` (city, meanAffinityRank, cellCount, thinData, or unavailable zero-cells), `caveats[]`, `evidence[]` |
| `Evidence` | `endpoint`, `redactedParams`, `responseDigest`, `fetchedAt`, `supports[]`, `cached` (never headers); numbers point to evidence through `evidenceIds` on `fit`, `standing` and `cityStrengths[]` |
| Core constants | In ADR 0013 today: `FIT_MIN_SHARED_TAGS` (3), thin data under 15 cells, the 5-point standing band. Design proposals to add to core and ADR 0013: `STANDING_BAND_POINTS` (5, as a named constant) and `FIT_CLOSE_SPREAD_POINTS` (5, close-values note). The recorded 2.5-point spread of three acts (ADR 0013) is only an example of a small spread, not the source of the threshold. |

## Measured facts the design is built to

From ADR 0013 and `docs/evidence/` (recorded 2026-10-26; sample: a crowd of 6 acts, 3 candidates, 8 heatmap cities).

- Fit is a mean of Qloo tag scores and is compressed: the three recorded candidates scored 60.6, 59.5 and 58.1 (spread 2.5 points). The design shows rank plus Fit and does not imply large gaps.
- Standing is the Qloo popularity percentile compared with the crowd median: a rank, not momentum.
- Heatmap values are rescaled per city, so cities are compared by mean affinity rank plus cell count. Under 15 cells is thin data: Jakarta (13), Mumbai (10), Lagos (1) and Tromso (1) are thin; London (406), Berlin (295), Leipzig (39) and Reykjavik (23) are not.
- Three scales are never mixed: Fit 0 to 100, Qloo popularity rank 0 to 100 ("higher is better known on Qloo"), mean affinity rank 0 to 1. Similar to the crowd median means within 5 percentile points.
- The other-cities strip shows the venue's city plus fixed defaults (London, Leipzig, Jakarta, Tromsø) and any city the reader adds, up to 5 in all (ADR 0004; owner decision 2026-10-27: defaults plus reader-chosen, no city list on the slate); they are not necessarily geographically near.
- Fit can be unavailable for four reasons, and standing for two; every one has designed copy.
