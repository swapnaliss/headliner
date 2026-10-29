# Screen: Slate

Route (indicative): `/slate/{slateId}`; the read-only shared version is described at the end. Reached from [match confirmation](screen-match-confirmation.md); each card leads to the [act detail](screen-act-detail.md). Built by M1-05 (page, loading, error, Banner) with M2-04 (shared page). Uses [components](components.md): ActCard, SkeletonCard, Caveat chip, EmptyState, ErrorState, ProgressStatus, ShareLinkField, Banner, Button.

## Purpose

Show the ranked candidate acts so a buyer can decide whom to look at more closely, and show why: for each act its audience-taste fit with the venue's crowd (Fit), the tastes they share, where the act stands on Qloo popularity rank, the caveats on those numbers, and a link to the Qloo evidence behind every number.

This is the hero screen of the demo. It must show four honest things at a glance:

1. **Rank first, Fit second.** Fit is a mean of Qloo tag scores, so values sit close together (the recorded sample spans 58.1 to 60.6, about 2.5 points). The page never implies large gaps; when the spread is small it says so.
2. **A second opinion that differs.** A side comparison with the order by Qloo popularity rank, which is a different question (how established an act is on Qloo, not how close its audience is to the crowd).
3. **Honest gaps.** An act with no data or no Fit stays visible with the reason; nothing is hidden or zeroed.
4. **Checkable numbers.** Every number links to the Evidence trail.

No momentum, growth or trend claim appears anywhere: the trending data in this environment is flat, and Qloo popularity rank is a standing, not a direction.

Users: the independent venue talent buyer (phone between calls, or desk), promoter or booker (shares the link with a co-programmer), and the hackathon judge (three minutes: sees the ranking, the differing popularity order, the caveats and the evidence within one scroll).

## Layout

Landmarks: `header` (wordmark + Banner), `main` (h1, room summary, notes, ranked list, not-ranked, explanation disclosure), `aside` "Compare orders and share" (complementary), `footer`. Headings: h1 "Slate for {city}" (display face; the city is wrapped in `<bdi class="entity">` so it renders in the system stack); h2 "Ranked acts", "Not ranked", "Compare with Qloo popularity rank order", "Share this slate", "Room used"; h3 per act name. The explanation is a disclosure whose summary "Explanation" stands in for its h2 (components.md, ExplanationBlock).

Content hierarchy, most important first (changed in the reskin): (1) which room and run: h1, subtitle, room summary; (2) slate-level notes (close values); (3) **ranked ActCards, directly under the summary**; (4) not-ranked acts with reasons; (5) the Explanation disclosure, closed; (6) comparison with popularity order, share, room used (aside at 1024px and up, below the main column otherwise).

The h1 is followed by the subtitle "Ranked by audience-taste fit with your crowd" and the room summary: "Compared with {n} crowd acts" with its disclosure, the shared-slate line, and the one-sentence "How to read Fit" caption. Nothing else sits between the title block and the first card except the close-values note.

### Mobile 390px (works from 320px)

One column, 16px gutters. Cards are stacked and full width; the rank numeral is 40px in a 3rem column. The comparison and share blocks follow the main column, after the closed Explanation.

```
+--------------------------------------+
| [H] Headliner       [Demo mode chip] |
| (i) Audience-taste fit is aggregate  |
|     affinity, not a ticket forecast. |
+--------------------------------------+
| Slate for Berlin                     |  h1 display
| Ranked by audience-taste fit with    |
| your crowd                           |
| Compared with 6 crowd acts  > Show   |
| Fit is the mean Qloo tag score ...   |
| (i) Fit values span 2.5 points.      |
|     Treat neighbouring ranks as      |
|     close.                           |
+--------------------------------------+
| Ranked acts (5)                      |  h2 display
| +----------------------------------+ |
| | 1  Reality Club            Fit   | |  rank hero (display, accent)
| |                            60.6  | |
| | [Electronic][Indie][Simple]      | |
| | 71 shared tastes with your crowd | |
| |                                  | |
| | Qloo popularity rank             | |
| | (o-) Below crowd median          | |
| | 86.4 of 100 vs crowd median 99.5 | |
| | Higher is better known on Qloo.  | |
| |                                  | |
| | (!) Thin data: Berlin, Leipzig   | |  one chip, one sentence
| | Fewer than 15 Qloo heatmap ...   | |
| | Open details >    Evidence (12)  | |  primary + one quiet link
| +----------------------------------+ |
| | 2  Sigur Ros ...                 | |
+--------------------------------------+
| Explanation                      >   |  closed disclosure
| Written from checked facts. ...      |  provenance line stays visible
+--------------------------------------+
| Compare with Qloo popularity rank .. |
| Share / Room used                    |
+--------------------------------------+
```

Standing glyph in the wireframe `(o-)`, `(-o-)`: a short horizontal median line with a dot above, on or below it (drawn as an SVG, never an arrow).

### Tablet 768px

One page column, 24px gutters. Cards use two columns under the head row (tags and count left, standing right); rank numeral 56px in a 4.5rem column. The aside content drops below the Explanation, as on mobile.

### Desktop 1280px

12-column grid. Main column in columns 1 to 8: h1, summary, notes, ranked list, not-ranked, Explanation disclosure. `aside` in columns 9 to 12: the comparison table, share block and room summary. The aside is sticky only at 1280px and above, only when it is shorter than the viewport and the viewport is at least 700px tall; at 1024px it sits beside the list without sticking. At 1440px the layout stays 1280px wide and centred. The aside starts level with the h1, so the comparison is visible next to the first cards without pushing the ranking down.

Each ActCard is a grid `4.5rem 1fr 11rem`: the rank numeral in the left column, so a buyer scans ranks down the left edge; name, tags and the shared-taste count in the middle; Fit above the standing block at the right. The caveat chip and its sentence, then the footer row (primary link left, quiet Evidence link right), span the full card.

```
+--------------------------------------------------------------------------------------+
| [H] Headliner                                                    [Demo mode chip]    |
| (i) Audience-taste fit is aggregate affinity, not a ticket forecast. It compares ... |
+--------------------------------------------------------------------------------------+
| Slate for Berlin                                       | Compare with Qloo popularity|
| Ranked by audience-taste fit with your crowd           | rank order                  |
| Compared with 6 crowd acts   (i) Fit values span 2.5.. | The orders differ ...       |
|                                                        | Act   Fit pos.  Pop. pos.   |
| Ranked acts (5)                                        | ...                         |
| +----------------------------------------------------+ |                             |
| | 1   Reality Club                      Fit    60.6  | | Room used                   |
| |     [Electronic][Indie][Simple]       Qloo pop. .. | | Berlin; crowd: 6 acts       |
| |     71 shared tastes with your crowd  (o-) Below.. | | [Make your own slate]       |
| |     (!) Thin data: Berlin, Leipzig ...             | |                             |
| |     Open details >                  Evidence (12)  | |                             |
| +----------------------------------------------------+ |                             |
| | 2   Sigur Ros ...                                  | |                             |
| > Explanation   Written from checked facts. ...        |                             |
+--------------------------------------------------------------------------------------+
```

### Card content rules

- **Rank**: an integer position by Fit descending (ties: name, then entity id; ADR 0013). Two acts with the same displayed Fit show "Same Fit as the act above; ordered by name" under the lower one.
- **Fit**: one decimal, label "Fit". No bar, gauge, star or percent sign.
- **Overlap tags**: the three highest-scoring shared tags as plain-text chips, then the text line "{n} shared tastes with your crowd". The separate link "See all {n} shared tastes for {name}" is removed from the card (the detail page lists them all and the card opens it). Tag labels are plain text.
- **Standing**: caption "Qloo popularity rank", label (Above, Similar to, Below crowd median), "{candidate} of 100 vs crowd median {median}" and the scale note "Higher is better known on Qloo." Similar means within 5 percentile points of the crowd median (exactly 5 is similar); Above is more than 5 points higher, Below more than 5 points lower (ADR 0013). Example: 100.0 against a median of 99.5 is Similar. Neutral colours; no arrows.
- **Caveats**: Caveat chips under the standing line, icon plus text. As built, a thin-data chip does show on the card when the run recorded it. When two or more cities are thin there is **one** chip naming them ("Thin data: Berlin, Leipzig") and the explanatory sentence ("Fewer than 15 Qloo heatmap cells back this city, so its strength is thin data.") is shown **once**. Fix: `mergeThinData` must de-duplicate the sentences instead of joining one per city. The sentence says "this city" even when two are named; wording is left as is and flagged for the owner.
- **Affordances**: one primary, "Open details" as a stretched link making the whole card the target, and one quiet secondary, "Evidence ({n} calls)" to the detail page Evidence trail anchored at that act. No boxed-and-underlined links, no third link.
- **Rank**: the hero of the card, display face, accent colour (components.md, ActCard). **Fit** is a printed number with one decimal and the label "Fit", smaller than the rank.
- **Unranked acts** appear under h2 "Not ranked ({n})" below the ranked list, in the order the run received them, each as a compact card with the reason (see States). A card with no Fit never shows a rank number.

## States

| State | What the user sees | Behaviour |
|---|---|---|
| Loading (scoring) | h1 and room summary appear immediately. A ProgressStatus: "Scoring {n} acts: {done} of {n} done." with a `<progress>`; below it a plain list of acts with a word status each ("Queued", "Scoring", "Done", "No data", with the matching icon); then {n} SkeletonCards. Ranks are not shown until every act has finished, so the order never reshuffles | `role="status"` region updates at most every 2 seconds and always at completion. Skeleton list is `aria-hidden`; list container `aria-busy="true"` until done. Reduced motion: skeletons are static; the progress text and bar still update |
| Loading, slow | After 20 seconds the status line adds "Still working. {s} seconds so far. Qloo requests that are not saved yet take longer." | The elapsed seconds are visible but not announced each second; the slow notice is announced once. Skeleton cards stay in place until results or an error arrive |
| Done | Ranked cards replace skeletons. Status line: "Slate ready: {r} acts ranked." | Announced once. Focus is not moved if the user is reading; if focus was on the progress region it moves to the h2 "Ranked acts" |
| Done, close values | Slate-level note "Fit values span {x} points. Treat neighbouring ranks as close." shown when the spread between best and worst Fit is below the single proposed core constant `FIT_CLOSE_SPREAD_POINTS` (5 points, a design proposal to be added to core and ADR 0013; the recorded sample's three acts span 2.5 points, which is only an example). The same constant drives the note on the act detail page. The note carries the DerivedCaption | Tied-looking pairs get the "Same Fit" line |
| Partial (some acts have no data) | Ranked list for the acts that scored; "Not ranked ({n})" group below; slate note "{n} of {total} acts could not be scored. They are listed below with the reason." | Caveat chip "No data" on each; button "Try this act again" per act |
| No data (single act) | Compact EmptyState in the card: title "No data for {name}", reason "Qloo returned nothing usable for this act, so no Fit or Qloo popularity rank is shown." | Never a 0, never hidden. Announced inside the status region when the slate completes |
| Fit unavailable (with other data) | In the Fit slot: neutral chip "Fit unavailable" and the reason (see Copy). Standing may still show | Card sits in "Not ranked" |
| Standing unavailable | Standing slot shows chip "Unavailable" and the reason; Fit and rank unaffected | Caveat chip "Popularity rank unavailable" |
| Stale cache | Notice at top: "Showing saved results from {date and time}. Qloo could not be reached for a fresh run." with Button "Try a fresh run" | Numbers and Evidence are those saved; Evidence rows say "from cache" |
| Partial run, failed | ErrorState (non-blocking): "The run stopped before it finished. {k} of {total} acts are shown." with "Try again" and a disclosure "What failed" listing failed calls (endpoint, time, status; no headers). Ranks read "ranked among the {k} that finished" | Role `status` when results are shown, `alert` when nothing is |
| Failed, nothing kept | ErrorState (blocking): "The run could not be completed. No acts were scored." with "Try again" and "Back to edit the room" | Focus moves to the heading |
| All acts unscorable | EmptyState: "No act could be scored." reason "Qloo returned no usable data for any candidate. Check the names on the match screen, or try different acts." | Link "Back to edit the room" |
| Budget reached | ErrorState: "The demo has reached its live-data limit for now. Open the sample slate, which uses recorded Qloo responses." | No login, no CAPTCHA |
| Empty (no slate id found / expired) | EmptyState: "This slate is no longer available." "Slates are kept for 30 days." | "Start a new slate" |
| Share copied | Message "Link copied." for 4 seconds in a polite region | Clipboard failure: link text selected, "Copy failed. The link is selected; press Ctrl+C." |
| Offline | Notice "You appear to be offline. This slate is shown as last loaded." | Evidence links that need the network remain links; no data is invented |
| Demo mode | Chip "Demo mode: recorded Qloo responses" in the header area | Evidence rows still show the recorded request summaries |

## Copy

| Element | String |
|---|---|
| Page title | "Slate for {city}: Headliner" |
| Banner | "Audience-taste fit is aggregate affinity, not a ticket forecast. It compares the tastes of each act's audience with your regular crowd, using Qloo data. It says nothing about sales, attendance or any individual." |
| h1 | "Slate for {city}" |
| h1 subtitle | "Ranked by audience-taste fit with your crowd" |
| Crowd summary | "Compared with {n} crowd acts" ; disclosure "Show crowd acts" |
| How to read Fit | "Fit is the mean Qloo tag score shared between an act's audience and your crowd, from 0 to 100. Read the rank first: Fit values are often close together." |
| Close-values note | "Fit values span {x} points. Treat neighbouring ranks as close." |
| Ties | "Same Fit as the act above; ordered by name." |
| List headings | "Ranked acts ({n})" ; "Not ranked ({n})" |
| Rank accessible | "Rank {r} of {n}" |
| Fit label / accessible | "Fit" / "Audience-taste fit {value} out of 100" |
| Fit unavailable: no-shared-tags | "Fit unavailable: Qloo found no tags shared between this act's audience and your crowd." |
| Fit unavailable: too-few-shared-tags | "Fit unavailable: only {n} shared tags found; at least 3 are needed." |
| Fit unavailable: unresolved-entity | "Fit unavailable: this name could not be matched to a Qloo entity." |
| Fit unavailable: candidate-in-crowd | "Fit unavailable: this act is also one of your crowd acts." |
| Standing caption | "Qloo popularity rank" |
| Standing labels | "Above crowd median" ; "Similar to crowd median" ; "Below crowd median" |
| Standing values | "{candidate} of 100 vs crowd median {median}" ; scale note "Higher is better known on Qloo." |
| Standing band note | "Similar means within 5 percentile points of the crowd median (exactly 5 is similar)." |
| Standing accessible | "Qloo popularity rank: {above/similar to/below} the crowd median, {candidate} out of 100 compared with a median of {median}. Higher means better known on Qloo." |
| Standing unavailable: candidate | "Qloo popularity rank unavailable: Qloo gave no popularity value for this act." |
| Standing unavailable: crowd | "Qloo popularity rank unavailable: Qloo gave no popularity value for your crowd acts." |
| Shared-taste count | "{total} shared tastes with your crowd" (text, no link) |
| Card links | "Open details" (accessible "Open details for {name}", stretched over the card) ; "Evidence ({n} calls)" (accessible "Evidence for {name}, {n} calls") |
| Caveat labels | "Thin data" ; "Fit unavailable" ; "Popularity rank unavailable" ; "Match chosen by you" ; "No data" ; "Saved result" ; "Run incomplete" |
| No data title / reason | "No data for {name}" / "Qloo returned nothing usable for this act, so no Fit or Qloo popularity rank is shown." |
| Retry act | "Try this act again" ; loading "Trying again…" |
| Loading status | "Scoring {n} acts: {done} of {n} done." |
| Act status words | "Queued" ; "Scoring" ; "Done" ; "No data" |
| Slow | "Still working. {s} seconds so far. Qloo requests that are not saved yet take longer." |
| Ready | "Slate ready: {r} acts ranked." / with gaps "Slate ready: {r} acts ranked, {k} with no data." |
| Partial note | "{k} of {total} acts could not be scored. They are listed below with the reason." |
| Failed run (partial) | "The run stopped before it finished. {k} of {total} acts are shown, ranked among the ones that finished." |
| Failed run (none) | "The run could not be completed. No acts were scored." |
| Failed actions | "Try again" ; "Back to edit the room" ; disclosure "What failed" |
| Stale | "Showing saved results from {date and time}. Qloo could not be reached for a fresh run." ; "Try a fresh run" |
| Compare heading | "Compare with Qloo popularity rank order" |
| Compare verdict | "The orders differ: {k} of {n} acts sit in a different position." ; identical: "The two orders match." |
| Compare table headers | "Act" ; "Fit position" ; "Popularity position" |
| Derived caption | "Derived from the Fit and Qloo popularity rank values above." with link "See evidence" |
| Compare unavailable row | "Not ranked by popularity" |
| Compare explanation | "Qloo popularity rank shows how well known an act is on Qloo. Fit shows how close its audience is to your crowd. They answer different questions." |
| Share heading / text | "Share this slate" / "Anyone with the link can open this read-only slate for 30 days. It shows the city, the crowd acts and the candidate acts as resolved Qloo names, each act's Fit, shared tastes, Qloo popularity rank and caveats, and the Qloo evidence. It shows nothing you typed. The link contains a random, unguessable id; share it only with people you trust." |
| Share button / done | "Copy link" / "Link copied." |
| Room heading | "Room used" ; "Change room" |
| Expired | "This slate is no longer available." / "Slates are kept for 30 days." / "Start a new slate" |
| Offline | "You appear to be offline. This slate is shown as last loaded." |

## Keyboard and a11y

- Tab order: skip link, wordmark link, Banner disclosure, crowd disclosure, then each card in rank order (its "Open details", then "Evidence"), then Not ranked cards, then the Explanation disclosure, then the aside (comparison table has no stops, then Copy link, then Change room), footer. On desktop the aside comes after the main list in both DOM order and tab order even though it sits to the right.
- Ranked acts are an ordered list (`<ol>`); the number a screen reader hears comes from the accessible rank text, not only the list position.
- The comparison is a real `<table>` with `<caption>` and `<th scope>` cells; the verdict sentence above it states the result in words.
- Live regions: exactly one polite `role="status"` for progress and the ready message; errors use `role="alert"`. No region announces per-act progress each time; per-act words are in the visible list for reading.
- Route change into this screen moves focus to the h1 (`tabindex="-1"`), and the document title updates.
- Standing, caveats and unavailable states always combine glyph, label and colour. The standing glyph is a position against a median line, not an arrow, so it cannot be read as a trend.
- Untrusted text: act names, tag labels and city are rendered as plain text; `dir="auto"` on names; names clamp to two lines with the full name in the heading's accessible text and on the detail page; no link is ever created from a name or tag. The "Open details" link target is built from the entity id by the app.
- 44px targets below 768px (Open details, Evidence, Copy link, disclosures); at least 8px between them. Layout reflows to 320px with no horizontal scroll; the comparison table may scroll inside its own container only if a single name cannot wrap, and then the container is focusable with a label.
- Buttons use `aria-disabled` and `aria-busy` while a request is in flight; none uses native `disabled`. Names inside attributes and live-region strings are wrapped in Unicode isolates (U+2068, U+2069).
- The aside is a complementary landmark; its derived numbers (comparison table, close-values note) carry the DerivedCaption.
- Reduced motion: no card entry animation, no progress bar transition; information is unchanged.

## Data source

Logical names from the architecture (`Slate`, `ActResult`, `Evidence`); the zod schema from M1-02 is the source of truth. Values are computed by code (ADR 0013); the LLM only phrases fields and writes no numbers.

| Element | Source |
|---|---|
| h1 city, crowd summary, "Room used" | `Slate.room.city`, `Slate.room.crowdActs[].name` |
| Run progress, act status words, ready message | `Run.state` (`scoring`, `done`, `failed`), `Run.progress { done, total }`, per-act status |
| Rank number | `ActResult.rank`, computed in core by Fit descending then name then entity id |
| Act name | `ActResult.act.name` (resolved Qloo entity name, plain text) |
| Fit | `ActResult.fit.value` (0..100, 1 decimal) or `ActResult.fit.unavailable` with the reason code (`no-shared-tags`, `too-few-shared-tags`, `unresolved-entity`, `candidate-in-crowd`) |
| Tied note | derived: adjacent `fit.value` equal at display precision |
| Close-values note | `Slate.fitSpread` (best minus worst Fit among ranked acts), computed in core |
| Overlap tag chips and "See all {n} shared tastes" link | `ActResult.overlapTags[]` (`label`, `score`), count = length |
| Standing line | `ActResult.standing.label` (`above`, `similar`, `below`), `.candidatePercentile`, `.crowdMedian`, or `.unavailable` with reason (`candidate-popularity-missing`, `crowd-popularity-missing`); caption fixed text |
| Caveat chips | `ActResult.caveats[]` (`code`, `label`) |
| Evidence link and call count | `ActResult.evidence[]` (`endpoint`, `redactedParams`, `responseDigest`, `fetchedAt`), count = length |
| Comparison table | `Slate.popularityOrder[]` (act ids ordered by candidate percentile) joined with `ActResult.rank`; both are positions derived by code from Fit and popularity values, not new measurements |
| Close-values constant | `FIT_CLOSE_SPREAD_POINTS` (design proposal, 5; to be added to core and ADR 0013), compared with `Slate.fitSpread` |
| Stale-cache notice | `Slate.generatedAt` and a cache-served flag on evidence |
| Share link and expiry | `Slate.id`, `Slate.expiresAt` (30 days, ADR 0002) |
| Banner, demo mode chip | static copy; server config flag |

## Shared page note (M2-04)

The shared slate (`/s/{slateId}`) is this screen in read-only form. It differs as follows, and nothing else:

- The Banner is present and unchanged.
- `noindex, nofollow` in both a robots meta tag and an `X-Robots-Tag` header; the page is not linked from anywhere public.
- Only resolved names appear: no typed text, no one-sentence description, no user-chosen annotations. Names stay plain text (CSP also blocks inline script).
- No "Change room", "Try this act again", "Try a fresh run" or share controls. A line shows "Shared slate, created {date}. Kept until {date}."
- Evidence trails are visible exactly as on the owner view (never headers or keys).
- Link to start your own: "Make your own slate".
- The id is a random, unguessable 21-character id; it is validated against the id format before any lookup and encoded when placed in a URL.
- Unknown or expired id: the same EmptyState as above ("This slate is no longer available."), with a 404 status and no hint whether the id ever existed.

## Explanation block (M3-02, reskin)

A `section` placed **below** "Ranked acts" and "Not ranked", collapsed by default behind a disclosure (components.md, ExplanationBlock). Before the reskin it sat above the ranked list and read as ten near-identical sentences; it is now supporting material. It also appears, for one act, on the act detail screen between the Fit, standing and caveats tiles and "Why this Fit" (caveats are read first); the detail page is unchanged.

- Summary text "Explanation". The source line stays visible next to the summary in both states, `field-hint` text: "Written from checked facts. Every figure in this text was checked against this slate before it was shown." or "Template. Built from this slate's values by a fixed template; no figure is added." Both are plain text; the source is also in `data-source`.
- Body (inside the closed `<details>`): one paragraph per line of text, `dir="auto"`, max width 70ch. React text nodes only: no HTML, no markdown, no links, so a name containing markup shows as typed. Content and wording are unchanged.
- The slate summary covers the room line and the top 3 ranked acts; the act detail covers that one act, including its saved city strengths and caveats.
- The Banner is unchanged. The template shows first (it is the loading state) and is replaced only by model text whose every figure is in the slate. The disclosure stays closed when the text is replaced.
- Wording: "audience-taste fit" and "Qloo popularity rank"; never forecast, turnout, "will sell" or any trend or momentum claim.
