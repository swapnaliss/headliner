# Screen: Act detail

Route (indicative): `/slate/{slateId}/act/{entityId}`, opened from a card on the [slate](screen-slate.md). Built by M2-02 (shared tastes, Evidence trail) and M2-03 (other-cities strip, loaded lazily). M2-04 reuses the plain-text rule and shows this page read-only on the shared slate. Uses [components](components.md): Banner, FitValue, StandingLine, Caveat chip, EvidenceRow, CityStrip, ThinDataBadge, EmptyState, ErrorState, Button.

## Purpose

Let a buyer check one act in depth: why it got its Fit, which tastes it shares with the regular crowd, where it stands on Qloo popularity rank, how its audience strength looks in other cities compared, and, above all, the Qloo evidence that every number rests on. The test of this page is that a skeptical programmer can follow any number to the recorded request that produced it.

It also shows the honest limits: caveats at the top, thin-data cities flagged and separated, and "unavailable" with a reason instead of a blank or a zero.

The page makes no claim about change over time. The trending data in this environment is flat, so there is no growth, momentum or "rising" language and no trend glyph. City strength is compared only by mean affinity rank and the number of heatmap cells behind it, because Qloo rescales raw affinity and popularity inside each city.

Users: the venue talent buyer weighing one booking (desk or phone), a promoter or artist manager double-checking the numbers, and the hackathon judge, who opens the top act to see shared tastes, the evidence, the nearby-cities strip with a thin-data flag, and (on another act) the honest empty state.

## Layout

Landmarks: `header` (name + Banner), `main`, `footer`. Headings: h1 is the full act name; h2 "Why this Fit", "Shared tastes", "Qloo popularity rank", "Other cities compared", "Evidence trail"; h3 inside Evidence rows is the endpoint. A small "On this page" list of anchor links appears under the h1 on desktop only; on mobile the page is short enough to scroll.

Content hierarchy: (1) which act and where it ranks, (2) Fit and standing side by side, (3) caveats, (4) why, (5) shared tastes, (6) Qloo popularity rank section, (7) other cities compared, (8) Evidence trail. Caveats come before the explanation so a limit is read before a number is trusted.

### Mobile 360px

One column. The wireframe shows the top-ranked act of the recorded sample slate (ADR 0013). Shared tags and city rows show layout only; real labels and values come from the run.

```
+--------------------------------------+
| Headliner        [Demo mode chip]    |
| (i) Audience-taste fit is aggregate  |
|     affinity, not a ticket forecast. |
+--------------------------------------+
| < Back to the slate                  |
| Reality Club                         |  h1 (wraps)
| Rank 1 of 3                          |
+--------------------------------------+
| Fit                                  |
| 60.6                                 |  text-2xl
| Audience-taste fit, 0 to 100.        |
| See evidence: 1                      |  link to #ev-1
|                                      |
| Qloo popularity rank                 |
| (o-) Below crowd median              |
| 86.4 of 100 vs crowd median 99.5     |
| Higher is better known on Qloo.      |
| See evidence: 2                      |
+--------------------------------------+
| Caveats                              |
| (!) Match chosen by you              |
| (!) Thin data: Jakarta, Lagos        |  after cities load
+--------------------------------------+
| Why this Fit                         |  h2
| Reality Club shares 71 tags with     |
| your crowd. The three with the       |
| highest Qloo scores are [tag], [tag] |
| and [tag]. Fit is the mean of the    |
| Qloo scores of those tags. Do not    |
| read a point or two as meaningful.   |
+--------------------------------------+
| Shared tastes (71)                   |  h2
| Tag        Score  Crowd acts covered |
| [tag]      0.81   5 of 6             |
| [tag]      0.77   4 of 6             |
| ... 10 rows ...                      |
| [ Show all 71 ]                      |  id=tastes
+--------------------------------------+
| Qloo popularity rank                 |  h2
| (o-) Below crowd median              |
| 86.4 of 100 vs crowd median 99.5     |
| Higher is better known on Qloo.      |
| Compared with 6 crowd acts that      |
| have a value. This is a standing on  |
| Qloo, not a measure of change or     |
| room size.                           |
+--------------------------------------+
| Other cities compared                |  h2
| Mean affinity rank, with the number  |
| of cells behind it. ...              |
| Cities compared: your venue's city   |
| and up to 4 others (defaults plus    |
| your own); not necessarily near      |
| your venue.                          |
| Berlin (your venue's city)           |
| [#########---] 0.847   295 cells     |
| Leipzig                              |
| [#######-----] 0.706   39 cells      |
| London                               |
| [######------] 0.599   406 cells     |
| Thin data: read with caution         |  h3
| Jakarta  [##/-------] 0.276          |
| (!) Thin data - 13 cells             |
| Lagos    [###/------] 0.325          |
| (!) Thin data - 1 cell               |
+--------------------------------------+
| Evidence trail (3 calls)             |  h2, id=evidence
| Evidence 1: GET /v2/insights/compare |  h3
|    Fetched 2026-10-26 09:14 +00:00   |
|    Supports: Fit, Shared tastes      |
|    > Show parameters and digest      |
| 2  GET /v2/search ...                |
| 3  GET /v2/insights/heatmap ...      |
| Request headers, including the API   |
| key, are never stored or shown.      |
+--------------------------------------+
| < Previous act    Next act >         |
+--------------------------------------+
```

The city names and numbers in the wireframe are the recorded heatmap results for one crowd act (ADR 0013 sample), used only to show how thin and non-thin rows look. Those rows would show the candidate's own heatmaps in the product.

Hatch pattern `/` in a bar marks thin data; it is a second cue next to the word badge, never the only one.

### Desktop 1280px

12 columns (a single column below 1024px; nothing is sticky on this screen). Top band: the act name spans the width; below it a three-tile row: Fit (columns 1 to 4), Qloo popularity rank (columns 5 to 8), Caveats (columns 9 to 12). Then "Why this Fit" full width at a 70ch measure. Shared tastes (columns 1 to 7, a table with three columns) and Other cities compared (columns 8 to 12) sit side by side, in that DOM and tab order. The Evidence trail is a full-width table. The "On this page" list sits under the name.

```
+--------------------------------------------------------------------------------------+
| Headliner                                                    [Demo mode chip]        |
| (i) Audience-taste fit is aggregate affinity, not a ticket forecast. It compares ... |
+--------------------------------------------------------------------------------------+
| < Back to the slate                                                                  |
| Reality Club    Rank 1 of 3        On this page: Shared tastes | Cities | Evidence    |
+--------------------------------------------------------------------------------------+
| Fit             | Qloo popularity rank      | Caveats                                |
| 60.6            | (o-) Below crowd median   | (!) Match chosen by you                |
| 0 to 100        | 86.4 of 100 vs crowd median 99.5 |                                        |
| See evidence: 1 | See evidence: 2           |                                        |
+--------------------------------------------------------------------------------------+
| Why this Fit  (sentence, 75ch)                                                       |
+--------------------------------------------------------------------------------------+
| Shared tastes (71)                              | Other cities compared                      |
| Tag        Score   Crowd acts covered           | Berlin  [#########] 0.847  295 cells|
| [tag]      0.81    5 of 6                       | Leipzig [#######  ] 0.706   39 cells|
| ...                                             | London  [######   ] 0.599  406 cells|
| [ Show all 71 ]                                 | Thin data: read with caution       |
|                                                 | Jakarta [##/      ] 0.276 13 cells |
+--------------------------------------------------------------------------------------+
| Evidence trail (3 calls)                                                             |
| #  Endpoint                 Parameters (redacted)    Response digest  Fetched   Supports|
| 1  GET /v2/insights/compare a=..., b=..., filter...  3f9a1c...        09:14      Fit... |
+--------------------------------------------------------------------------------------+
| < Previous act: Radiohead                              Next act: Khruangbin >        |
+--------------------------------------------------------------------------------------+
```

## States

| State | What the user sees | Behaviour |
|---|---|---|
| Loading page | Server-rendered: h1, Fit, standing, tastes and evidence arrive in the first response from the saved slate. Only the Other cities compared section loads afterwards | No full-page spinner |
| Fit shown | As wireframe | "See evidence: n" links go to `#ev-n`; the target row is outlined and carries the text "Linked from above" while focused |
| Fit unavailable | The Fit tile shows a neutral chip "Fit unavailable" with the reason sentence (see Copy). "Why this Fit" is replaced by "Why Fit is unavailable" with the same reason plus what the user can do | The rank line reads "Not ranked". No number is displayed in the Fit tile |
| Few shared tags (1 or 2) | Shared tastes lists the tags that were found, with the line "Only {n} shared tags found; at least 3 are needed for a Fit." | Fit unavailable as above |
| No shared tags | Shared tastes is an EmptyState: "No shared tastes found" with reason | Evidence trail still lists the compare call |
| Standing unavailable | Qloo popularity rank tile shows chip "Unavailable" and its reason | Fit unaffected |
| No data (whole act) | Hero shows "No data for {name}". The Fit, Qloo popularity rank and Caveats tiles shrink to compact panels (the "Fit unavailable" chip and "Not ranked" stay). "Other cities compared" is replaced by one neutral line with the dash icon, "No city comparison without data."; no city-strength request is made. Evidence trail lists the calls that returned nothing usable, so the gap is itself checkable | Nothing is hidden or zero-filled; a neutral note, never an error, stands where the cities would be |
| Caveats present | Caveat chips at the top with a full sentence for each in a list below the tiles (`detail` text) | Chips and sentences use icon plus text |
| Shared tastes, long list | First 10 tags shown, then Button "Show all {n}" | Expanding keeps focus on the button, which becomes "Show fewer"; the table does not reorder. A polite status message says "Showing all {n} shared tastes." |
| Other cities compared: idle | The section heading and caption render; below, a skeleton line and (only if the observer is unavailable) Button "Load city strength" | Loading starts when the section is within one screen of the viewport, so the Qloo calls (up to 5) are not spent unless the user scrolls near |
| Other cities compared: loading | Status "Loading city strength: {done} of {total} cities." rows appear as cities complete; remaining rows are skeleton lines | Polite `role="status"`, updated at most every 2 seconds and on completion |
| Other cities compared: ready | Rows ordered as in CityStrip: enough-data cities by mean affinity rank, then "Thin data: read with caution" group | Announced once: "City strength loaded for {n} cities. {t} have thin data." |
| Other cities compared: thin data | Rows with fewer than 15 cells show the inline ThinDataBadge, a hatched bar and "{n} cells, fewer than 15" (no per-row sentence; the Caveats card says it once); they never sit among the ranked cities, even with a high mean (a one-cell city can have a high mean) | A "Thin data: {cities}" caveat chip is added to the Caveats tile once the cities have loaded (before that the tile has no city caveat). The section itself carries no second summary chip: thin data is stated in the Caveats tile (once, with one sentence) and in the "Thin data: read with caution" group, never three times. The chip reads "Thin data: A, B" with one space after the colon |
| Other cities compared: zero cells | Row shows city name and EmptyState compact: "No heatmap cells for {city}: Qloo returned no usable audience data there." | No bar, no number |
| Other cities compared: partial | Cities that loaded are shown; each failed city has an inline error row "Could not load {city}" with "Try again" | Others unaffected |
| Other cities compared: failed | ErrorState compact: "Could not load city strength. The rest of this page is unaffected." with "Try again" | Focus stays where it was; alert announced |
| Evidence: from cache | Row marks "from cache" with the original fetched time | Never presented as a new call |
| Evidence: failed call | Row status "Failed" with error icon, endpoint, time, "No digest" | Failed calls are evidence of the gap |
| Act not found (unknown or malformed id) | EmptyState: "This act is not on this slate." with "Back to the slate" | 404 status. The entity id in the route is validated against the slate's act list and its format, treated as untrusted, and encoded with `encodeURIComponent` wherever it is placed in a URL |
| Offline | Notice "You appear to be offline. The page is shown as last loaded; city strength cannot load." | Other cities compared shows its error state with "Try again" |
| Read-only shared view | Same content; no retry or share controls | See slate spec, shared page note |

## Copy

| Element | String |
|---|---|
| Page title | "{name}: Headliner" |
| Banner | "Audience-taste fit is aggregate affinity, not a ticket forecast. It compares the tastes of each act's audience with your regular crowd, using Qloo data. It says nothing about sales, attendance or any individual." |
| Back / prev / next | "Back to the slate" ; "Previous act: {name}" ; "Next act: {name}" |
| Rank line | "Rank {r} of {n}" ; unranked "Not ranked" |
| Fit tile | label "Fit" ; caption "Audience-taste fit, 0 to 100." ; link "See evidence: {n}" ; when `Slate.fitSpread` is below `FIT_CLOSE_SPREAD_POINTS` (5 points, a design proposal to be added to core and ADR 0013; the recorded sample's 2.5-point spread is only an example): "On this slate Fit values span {x} points, so neighbouring ranks are close." with the DerivedCaption "Derived from the Fit and Qloo popularity rank values above." and a "See evidence" link |
| Standing tile | label "Qloo popularity rank" ; labels "Above crowd median" / "Similar to crowd median" / "Below crowd median" ; values "{candidate} of 100 vs crowd median {median}" ; scale note "Higher is better known on Qloo." ; band note "Similar means within 5 percentile points of the crowd median (exactly 5 is similar). For example 100.0 against 99.5 is Similar." |
| Caveats tile | heading "Caveats" ; empty: "No caveats recorded for this act." (still shown, so absence is explicit) |
| Why this Fit | "{name} shares {n} tags with your crowd. The three with the highest Qloo scores are {t1}, {t2} and {t3}. Fit is the mean of the Qloo scores of those shared tags. Do not read a difference of a point or two as meaningful." |
| Why unavailable heading | "Why Fit is unavailable" |
| Fit unavailable reasons | no-shared-tags: "Qloo found no tags shared between this act's audience and your crowd." ; too-few-shared-tags: "Only {n} shared tags found; at least 3 are needed." ; unresolved-entity: "This name could not be matched to a Qloo entity. Go back to the match step to choose or fix it." ; candidate-in-crowd: "This act is also one of your crowd acts, so it is not compared with itself." |
| Shared tastes heading | "Shared tastes ({n})" |
| Shared tastes columns | "Tag" ; "Score" ; "Crowd acts covered" ; cell "{k} of {m}" |
| Shared tastes caption | "Tags that Qloo finds in both this act's audience and your crowd's. Score is the Qloo tag score from 0 to 1." |
| Show all / fewer | "Show all {n}" ; "Show fewer" |
| No shared tastes | "No shared tastes found" / "Qloo returned no tags shared between this act's audience and your crowd." |
| Standing section note | "Compared with the median of {k} crowd acts that have a Qloo popularity value. This is a standing on Qloo (0 to 100, higher is better known), not a measure of change over time or room size." |
| Standing unavailable reasons | candidate: "Qloo gave no popularity value for this act." ; crowd: "Qloo gave no popularity value for your crowd acts." |
| Cities heading | "Other cities compared" |
| Cities caption | "Mean affinity rank is the average of Qloo's affinity rank (0 to 1) across a city's heatmap cells, shown with the number of cells behind it. It is a different scale from Fit and from Qloo popularity rank. Qloo rescales raw affinity and popularity inside each city, so cities are compared only by these two numbers." |
| Cities selection | "Cities compared: your venue's city and up to 4 others: fixed defaults plus cities you add. They are not necessarily close to your venue." |
| Thin caveat chip | "Thin data: {cities}" (city names plain text, joined with commas) |
| Show all announcement | "Showing all {n} shared tastes." ; "Showing the first 10 shared tastes." |
| Evidence count growth | "Evidence trail now lists {n} calls." |
| City row | "{city}" ; "Your venue's city" ; "Mean affinity rank {value}" ; "{n} cells" (singular "1 cell") |
| Thin group heading | "Thin data: read with caution" |
| ThinDataBadge block | Not used on the city rows (the sentence is said once on the Caveats card). A thin row shows the inline chip and the figure "{n} cells, fewer than 15". |
| Zero cells | "No heatmap cells for {city}: Qloo returned no usable audience data there." |
| Cities loading | "Loading city strength: {done} of {total} cities." |
| Cities done | "City strength loaded for {n} cities. {t} have thin data." (zero thin: omit second sentence) |
| Cities button / retry | "Load city strength" ; "Try again" |
| City row failure | "Could not load {city}" |
| Cities failure | "Could not load city strength. The rest of this page is unaffected." |
| Evidence heading | "Evidence trail ({n} calls)" (singular "1 call"); the count grows when city strength adds calls |
| Evidence intro | "Each number on this page comes from the Qloo calls below. Parameters are redacted summaries." |
| Evidence labels | "Endpoint" ; "Parameters (redacted)" ; "Response digest" ; "Fetched" ; "Supports" ; "from cache" ; "Failed" ; "No digest" |
| Evidence supports words | "Fit" ; "Shared tastes" ; "Qloo popularity rank" ; "City strength" |
| Evidence disclosure | "Show parameters and digest" / "Hide parameters and digest" |
| Evidence footnote | "Request headers, including the API key, are never stored or shown." |
| Linked marker | "Linked from above" |
| No data | "No data for {name}" / "Qloo returned nothing usable for this act, so no Fit or Qloo popularity rank is shown." |
| Act not found | "This act is not on this slate." / "Back to the slate" |
| Offline | "You appear to be offline. The page is shown as last loaded; city strength cannot load." |

Number formats: Fit one decimal; popularity values one decimal; tag score two decimals; mean affinity rank three decimals; cell counts as integers; all through the page locale.

## Keyboard and a11y

- Tab order follows the visual order: skip link, back link, "On this page" links (desktop), "See evidence" links, caveat disclosures, tag table "Show all", city rows' links, Evidence disclosures, previous and next links, footer.
- Focus moves to the h1 (`tabindex="-1"`) on arrival; the title is the act name. Anchor links (`#ev-n`, `#evidence`) move focus to the target (`tabindex="-1"` on the row) and the target shows the 3px outline and the "Linked from above" text.
- Tables: shared tastes and, from 1024px, the Evidence trail are real `<table>` elements with `<caption>` and `<th scope="col">` (row header cell `<th scope="row">`, no headings inside); below 1024px the Evidence trail is a list where each row has an h3 "Evidence {n}: {endpoint}" and a `<dl>` (the same content in a different structure; the page never hides a field on mobile).
- Bars (mean affinity rank) are decorative: the value is printed as text beside the bar, and the bar itself is `aria-hidden`. A `<meter>` is not used because the value is a rank, not a quantity with a range to interpret.
- Thin data: badge text plus the hatch plus the grouping heading; a screen reader hears "Thin data, 13 cells" in the row. A single-cell city's high mean is never highlighted.
- Live regions: one polite `role="status"` for city strength progress and completion; the error for a failed section uses `role="alert"`.
- Untrusted text: the act name (h1), tag labels, city names, descriptors and every evidence parameter are rendered as plain text; `dir="auto"` on each; the h1 wraps fully and is the place where a truncated slate name is shown in full; long unbroken strings use `overflow-wrap: anywhere`. Evidence parameters are shown as text in monospace and never turned into links. Names placed inside `aria-label` or live-region strings are wrapped in Unicode isolates (U+2068, U+2069); in markup they use `<bdi>`. Retry buttons use `aria-disabled` and `aria-busy`, never native `disabled`.
- Contrast and focus ring pairs are in design-system.md. Targets are 44px below 768px: disclosures, "Show all", previous and next, retry buttons.
- 320px: the shared tastes table scrolls inside a labelled, focusable container (`role="region"` with `aria-label="Shared tastes table"` and `tabindex="0"`) only when a single tag cannot wrap; otherwise it reflows. No page-level horizontal scroll.
- Reduced motion: the bar width change on load is skipped; the status text still updates.

## Data source

Logical names; the M1-02 zod schema is the source of truth.

| Element | Source |
|---|---|
| h1 | `ActResult.act.name` (resolved Qloo entity name; plain text) |
| Rank line, prev and next | `ActResult.rank` and the ordered `Slate.acts[]` |
| Fit tile | `ActResult.fit.value` or `ActResult.fit.unavailable` (reason code and, for too few tags, the count found) |
| Why this Fit | templated from `ActResult.fit.value`, `ActResult.overlapTags.length` and the top three `overlapTags[].label` by score; any LLM phrasing may use only these fields |
| Shared tastes table | `ActResult.overlapTags[]` (`label`, `score` 0..1, `coveredCrowdActs` out of `Slate.room.crowdActs.length`) |
| Standing tile and section | `ActResult.standing` (`label`, `candidatePercentile`, `crowdMedian`, `crowdSample`) or `.unavailable` reason |
| Caveats tile and sentences | `ActResult.caveats[]` (`code`, `label`, `detail`) |
| Other cities compared | `ActResult.cityStrengths[]` (`city`, `meanAffinityRank` to 3 decimals, `cellCount`, `thinData` where `cellCount < 15`, or `unavailable: zero-cells`), filled lazily by the city-strength request (up to 5 heatmap calls, ADR 0004); `isVenueCity` derived by comparing with `Slate.room.city`; the cities are the room city, the fixed defaults and the reader-chosen additions (ADR 0004: up to 5 per act; owner decision 2026-10-27), not geography |
| Cities progress | per-request progress of the lazy loader |
| Close-values note | `Slate.fitSpread` against the proposed core constant `FIT_CLOSE_SPREAD_POINTS` (5; to be added to core and ADR 0013) |
| Evidence trail | `ActResult.evidence[]` (`endpoint`, `redactedParams`, `responseDigest`, `fetchedAt`), plus a `supports` list and `cached` flag per item; no headers exist in the model |
| "See evidence" links | `ActResult.fit.evidenceIds`, `standing.evidenceIds`, `cityStrengths[].evidenceIds` (indexes into `evidence[]`) |
| Banner | static copy |

Every number on this page has at least one evidence index; a number without one must not be rendered (invariant from the architecture), and the build test for this screen asserts it.

## Reskin notes (editorial booking desk)

Only tokens and button levels change here; no wording changes. One content grid: Fit, Qloo popularity rank and Caveats are three equal-height tiles from 768px; every section below (Why this Fit, Shared tastes, Qloo popularity rank, Other cities compared, Evidence trail) uses the same full content width, prose capped at 70ch, tables and city rows full width. "See evidence" number links are 44px targets below 768px with the separator comma drawn inside the box next to the digit.

- h1 (the full act name) is third-party text: it stays in `--font-sans`, weight 700, `--text-xl` on mobile and `--text-2xl` from 1024px. The h2 headings ("Why this Fit", "Shared tastes", ...) use the display face. The Fit number on the tile stays a printed number in `--font-sans` at `--text-2xl`, one decimal, no bar, ring or percent sign.
- Buttons follow the hierarchy in components.md: "Show all {n}" and "Load city strength" are secondary; "Try again" is secondary; "See evidence", the back link and previous and next are tertiary (accent, underlined). There is no primary button on this page, because the page's job is reading.
- Links and the selected or linked-from-above outline use `--accent` / `--focus` from the new tokens; the Evidence row outline stays the 3px `--focus` ring plus the text note.
- The slate card now opens this page from a stretched "Open details" link and no longer links to "#tastes"; the "Shared tastes" section is reached by scrolling or the "On this page" list.
