# Components

Specs for every component the four screens use. Tokens are in [design-system.md](design-system.md). Screens that compose these are in [screen-room-setup.md](screen-room-setup.md), [screen-match-confirmation.md](screen-match-confirmation.md), [screen-slate.md](screen-slate.md) and [screen-act-detail.md](screen-act-detail.md).

## Conventions for every component

- **Untrusted text.** Act names, tag labels, city names and any other string that came from Qloo, the user or the LLM are rendered as plain text through the framework's normal text escaping. Never `dangerouslySetInnerHTML`, never a markdown renderer, never auto-linking, never an `href` built from a name. Props that carry such strings are typed `string` and documented as "plain text" below.
- **Direction.** Any element showing an entity name sets `dir="auto"` (inline: wrap in `<bdi>`). Surrounding labels stay in the interface direction.
- **Long names.** Names truncate with CSS (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap` on one-line contexts, or `-webkit-line-clamp: 2` on cards). The full name is always reachable without hover: it appears in full on the act detail heading and in the accessible name (`title` is not relied on). In wrapped contexts (MatchPicker, detail h1) names wrap with `overflow-wrap: anywhere`.
- **States listed per component:** default, hover, focus, disabled, loading, error. "n/a" means the state does not exist for that component, with the reason. Hover never carries information that is not available by keyboard or touch. Focus is the ring from design-system.md section 6 on every focusable part.
- **Numbers** use tabular figures. Formatting uses the page locale (`Intl.NumberFormat`); wireframes show `.` as the decimal separator.
- **Bidi isolation in strings.** In markup an entity name is wrapped in `<bdi>`. Where it is placed inside an attribute or a live-region string (`aria-label`, announcements), wrap it in Unicode isolates U+2068 and U+2069 so a right-to-left name cannot reorder the sentence.
- **Buttons never use native `disabled` while a request is in flight** (see Button); they use `aria-disabled` plus `aria-busy`.
- **Names in the build.** Proposed component names are PascalCase as below; M1-05 may split files but keeps these names so the specs stay searchable.

---

## Banner

The reading note shown on every screen, first thing under the header. Not dismissible, not collapsible, never hidden at any width.

| | |
|---|---|
| Element and role | `<aside role="note" aria-label="How to read this page">` inside `<header>`. Not a live region. |
| Props | none for text (fixed copy, below). `detailsOpen?: boolean` for the optional disclosure. |
| Copy | "Audience-taste fit is aggregate affinity, not a ticket forecast. It compares the tastes of each act's audience with your regular crowd, using Qloo data. It says nothing about sales, attendance or any individual." |
| Short copy at 360px | Same first sentence always visible; the rest sits in a `<details>` labelled "What this means" so the banner stays at two lines. At 768px and up all text is visible. |
| Look | `--banner-bg`, `--banner-fg`, 1px `--banner-border`, `--radius-2`, info icon plus text, `--text-sm`. |
| Accessible name | "How to read this page" |

| State | Behaviour |
|---|---|
| default | as above |
| hover | n/a (no interaction except the disclosure summary, which has an underline on hover) |
| focus | ring on the disclosure summary only |
| disabled | n/a |
| loading | present immediately; it is static text, not data |
| error | n/a; it is also shown on error pages |

---

## Button

| | |
|---|---|
| Element and role | `<button>` for actions, `<a>` styled as a button for navigation. Role is implicit. |
| Props | `variant: "primary" \| "secondary" \| "quiet"`, `children: string`, `loading?: boolean`, `loadingLabel?: string`, `disabledReason?: string`, `type`, `onClick`, `icon?: IconName` (decorative) |
| Size | minimum height and width `--target` (44px on small screens). Padding inline 16px. Label `--text-base`, weight 600. Labels are verbs: "Rank these acts", not "Submit". |
| Accessible name | its visible text (plus `aria-label` only when the visible text is an icon; avoid). |

| State | Behaviour |
|---|---|
| default | primary: `--accent` fill, `--on-accent` text. secondary: `--surface` fill, `--accent` text and 1px `--accent` border. quiet: text in `--link`, underlined, no border. |
| hover | primary uses `--accent-hover`; secondary and quiet add an underline. Not the only cue to being clickable (the border and fill already are). |
| focus | 3px focus ring, 2px offset. |
| disabled | A control that is unavailable because of missing input uses `aria-disabled="true"` (not the `disabled` attribute) so it stays focusable and can be explained; activating it does nothing except move focus to the first thing that needs fixing and announce the reason. The reason sits visibly under or beside the button and is linked with `aria-describedby`. Look: `--sunken` fill, `--text-muted` text, dashed `--border-control`. The native `disabled` attribute is not used at all, so focus is never lost. |
| loading | label changes to `loadingLabel` (for example "Ranking…"), a 16px spinner icon (static dot ring under reduced motion) precedes it, `aria-busy="true"` and `aria-disabled="true"`, the button keeps its width and its focus, repeat activation is ignored. Progress detail is in a separate live region on the page, not inside the button. |
| error | n/a on the button. The failure appears in an ErrorState or TextField message, and the button returns to default so the user can retry. |

---

## TextField (with error text)

Used for the city, each act name, the one-sentence description and the share link (read-only).

| | |
|---|---|
| Element and role | `<label>` + `<input type="text">` or `<textarea>`; error and hint in `<p>` elements referenced by `aria-describedby`. |
| Props | `id`, `label: string`, `hint?: string`, `error?: string`, `value`, `onChange`, `maxLength`, `autoComplete="off"`, `inputMode`, `readOnly?`, `required?: boolean`, `lang?`, `multiline?: boolean`, `rows?` |
| Structure | label above the input (never placeholder-only); hint below the label in `--text-muted`; input; error message below the input with the error icon and text. Required fields are marked with the word "required" in the label text, not only an asterisk. |
| Input look | 16px text (prevents zoom on iOS), `--surface` fill, 1px `--border-control`, `--radius-1`, minimum height `--target`. `dir="auto"` so right-to-left input aligns correctly. |
| Accessible name | the label text. Description: hint and error ids joined in `aria-describedby`. `aria-invalid="true"` when `error` is set. |

| State | Behaviour |
|---|---|
| default | as above |
| hover | no visual change except the text cursor; the border already meets 3:1 |
| focus | focus ring; no border-colour-only change |
| disabled | `readOnly` is used, never `disabled`: `--sunken` fill and `--text-muted` text, and the lock reason appears in the page live region |
| loading | n/a for typing. When the field triggers an async check (city lookup is not required), a text status "Checking…" appears in the hint position |
| error | 1px border in `--error-fg` plus an inset 1px ring in `--error-fg` (no change of border width, so nothing moves), error icon plus message in `--error-fg` below the field (message text is specific: what is wrong and how to fix it, see copy decks), `aria-invalid`, message id in `aria-describedby`. On submit the first invalid field receives focus and an error summary above the form lists every error as a link to its field |

---

## ActChip

A removable or selectable pill showing one act name (typed crowd and candidate acts in room setup, confirmed matches in the summary).

| | |
|---|---|
| Element and role | `<li>` in a `<ul aria-label="Crowd acts">`; the remove control is a `<button>`. The chip text is not interactive. |
| Props | `name: string` (plain text), `status: "typed" \| "matched" \| "needs-choice" \| "no-match"`, `onRemove?`, `onEdit?` |
| Spacing | chips in a list have 8px gap in both directions; each remove button's 44px hit area does not overlap its neighbours (row gap of 8px, chips wrap at 360px) |
| Look | `--radius-pill`, `--neutral-bg`, 1px `--border-control`; the status icon and word sit inside the chip ("Matched", "Needs choice", "No match"); name `--text-base`, truncated at 24ch with the full name in the accessible name. |
| Remove button | 44px target (the visible chip stays 32px tall; the hit area extends). Accessible name: "Remove {name} from crowd acts" (or "candidate acts"). After removal focus moves to the next chip, or to the add field if none remain, and a live region says "{name} removed. {n} crowd acts left." |
| Accessible name | "{name}, {status text}" |

| State | Behaviour |
|---|---|
| default | typed, not yet matched: no status word |
| hover | remove button shows a `--sunken` circle |
| focus | ring on the remove button (and on the chip text when `onEdit` makes it a button) |
| disabled | while ranking runs: remove button hidden, chip kept |
| loading | status word "Matching…" with the progress icon |
| error | status "No match" with the error icon, and a link-style button "Fix" that focuses the matching row on the match confirmation screen |

---

## ActCard

One candidate act on the slate. Rendered as `<li>` inside `<ol aria-label="Ranked acts">` (order matters, so an ordered list). Cards are flat, bordered, never nested.

| | |
|---|---|
| Element and role | `<li><article aria-labelledby="{id}-name">`. The act name is an `<h3>`. |
| Props | `rank: number \| null`, `name: string` (plain text), `fit: { value: number } \| { unavailable: FitReason }`, `overlapTags: { label: string; score: number }[]` (first 3 shown), `standing: { label: "above"\|"similar"\|"below"; candidatePercentile: number; crowdMedian: number } \| { unavailable: StandingReason }`, `caveats: Caveat[]`, `evidenceHref: string`, `detailHref: string`, `tiedWithPrevious?: boolean`, `state: "ready" \| "no-data" \| "loading"` |
| Content order (top to bottom) | rank, name; Fit (or "Fit unavailable" with reason); overlap tag chips; standing line (caption "Qloo popularity rank", glyph and label, "{n} of 100 vs crowd median {m}", "Higher is better known on Qloo."); caveat chips; links "Open details", "See all {n} shared tastes for {name}" and "Evidence (n calls)". |
| Rank | A numeral in a 32px square (text, not an image). Accessible: "Rank 2 of 3". Unranked acts show "Not ranked" text in the same slot (no number, no dash alone). |
| Fit | `--text-lg` bold number with one decimal and the label "Fit" above in `--text-sm`. Accessible text: "Audience-taste fit 60.6 out of 100". If `tiedWithPrevious`, a neutral note "Same Fit as the act above; ordered by name". |
| Overlap tags | up to 3 chips (plain-text labels); a separate text link "See all {n} shared tastes for {name}" follows the chips and goes to the shared tastes section of the detail page. The chips themselves are plain text, not links or buttons. |
| Standing | `Qloo popularity rank` caption (always the exact caption), then glyph plus label ("Below crowd median"), then "86.4 of 100 vs crowd median 99.5" and the scale note "Higher is better known on Qloo." Similar means within 5 percentile points of the median (exactly 5 is similar; 100.0 vs 99.5 is Similar). Never arrows or colour-coded good or bad. If unavailable: neutral chip "Unavailable" with the reason text. |
| Evidence link | "Evidence (3 calls)" (singular "Evidence (1 call)") goes to `{detailHref}#evidence`. Accessible name: "Evidence for {name}, 3 calls". |
| Accessible name | the heading: "{name}". Each section is announced in reading order; Fit and standing are plain text, not decorative. |

| State | Behaviour |
|---|---|
| default | as above |
| hover | the card does not change (it is not itself interactive); links inside it underline. Nothing is revealed only on hover. |
| focus | ring on each link; the card itself is not focusable |
| disabled | n/a |
| loading | replaced by SkeletonCard (the slate shows progress, not partial ranks) |
| error / no data | The card keeps its place in the "Not ranked" group and shows an EmptyState (compact) in place of Fit and tags: "No data" with the reason, and a button "Try this act again". Caveat chip "No data" is present. |

Layout: at 360px everything stacks in one column with 16px padding; at 1280px rank + name + Fit sit in a row on the left, tags and standing in the middle column, links on the right (see screen-slate.md).

---

## Caveat chip

A short flag attached to a card or a section explaining a limit on the number next to it. Always icon plus text.

| | |
|---|---|
| Element and role | `<li>` in a `<ul aria-label="Caveats">`, or a `<span>` when single. Plain text; no role override. |
| Props | `code: CaveatCode`, `label: string` (fixed per code), `detail?: string` (full sentence, shown on the detail page and in a disclosure on cards), `severity: "caution" \| "unavailable" \| "info"` |
| Look | `--radius-pill`; icon (triangle for caution, dash circle for unavailable, i circle for info) + label in `--text-sm` weight 600; colour pair from the status table. |
| Codes and labels | `thin-city-data` "Thin data" (appears only on the act detail page, after city strength has loaded; the slate cards do not show it because city strength is loaded lazily and may not exist yet); `fit-unavailable` "Fit unavailable"; `standing-unavailable` "Popularity rank unavailable"; `low-match-confidence` "Match chosen by you"; `no-data` "No data"; `stale-cache` "Saved result"; `partial-run` "Run incomplete" |
| Accessible name | "Caveat: {label}" (the word "Caveat" is visually hidden when the chip is inside a list that is already labelled "Caveats"). |

| State | Behaviour |
|---|---|
| default | as above |
| hover | n/a (not interactive); when `detail` exists, the chip is wrapped by a button "{label}, show explanation" using the disclosure pattern and gains hover underline |
| focus | ring on the disclosure button |
| disabled | n/a |
| loading | n/a (caveats are computed with the result) |
| error | n/a |

---

## EvidenceRow

One recorded Qloo call behind one or more numbers. Evidence is the redacted summary of the request, not the raw request. Headers, keys and cookies are never part of the data model and are never shown.

| | |
|---|---|
| Element and role | Below 1024px: `<ol aria-label="Evidence trail">`, each row an `<li id="ev-{n}">` with an `<h3>` "Evidence {n}: {endpoint}" followed by a `<dl>`. From 1024px: a `<table>` with `<th scope="col">` headers and the row's first cell a `<th scope="row" id="ev-{n}">` "{n} {endpoint}"; no h3 inside the table. The fields are the same at every width. |
| Props | `index: number`, `endpoint: string` (for example `GET /v2/insights/compare`), `redactedParams: Record<string, string>` (plain text), `responseDigest: string`, `fetchedAt: string` (ISO 8601), `supports: ("fit" \| "overlapTags" \| "standing" \| "cityStrength")[]`, `cached?: boolean` |
| Fields shown | **Endpoint** in monospace. **Parameters** as `key=value` lines in monospace (ids and filter types; wrapped with `overflow-wrap: anywhere`). **Response digest** first 12 characters of the SHA-256 in monospace, with the label "Response digest". **Fetched** as `<time datetime="{iso}">` showing local date and time plus the UTC offset, and "from cache" when `cached`. **Supports** as plain words: "Fit", "Shared tastes", "Qloo popularity rank", "City strength". |
| Never shown | request headers (including `X-Api-Key`), the key, cookies, IP, raw response body. A static line under the list says: "Request headers, including the API key, are never stored or shown." |
| Accessible name | "Evidence {index}: {endpoint}". The anchor `#ev-{n}` is the target of "see evidence" links next to numbers. |

| State | Behaviour |
|---|---|
| default | collapsed to one line (endpoint + fetched time + "Supports …") with a disclosure button "Show parameters and digest"; at 768px and up parameters are visible |
| hover | summary underline |
| focus | ring on the disclosure button; when reached through an in-page anchor, the target row gets a 3px outline in `--focus` and a "Linked from above" text note (colour is not the only cue) |
| disabled | n/a |
| loading | skeleton lines (3) while evidence for lazily loaded city strength is still arriving; the Evidence trail heading count grows as rows are added and a status message says "Evidence trail now lists {n} calls." |
| error | a failed call is itself evidence: the row shows status "Failed" (error icon), the endpoint, the time, and "No digest" instead of a hash |

---

## SkeletonCard

Placeholder with the same outer size as an ActCard so the page does not jump.

| | |
|---|---|
| Element and role | `<li aria-hidden="true">`. Not announced individually. The list container is `aria-busy="true"` and a separate `role="status"` region says what is happening (see screen-slate.md). |
| Props | `lines?: number` (default 4) |
| Look | `--neutral-bg` blocks with `--radius-1`; opacity pulse 1.4s (design-system.md section 5). Under reduced motion the pulse stops. |
| Accessible name | none (hidden); the progress text carries the meaning |

| State | Behaviour |
|---|---|
| default / loading | the placeholder itself |
| hover, focus, disabled, error | n/a: not interactive. If loading exceeds 20 seconds the status line adds the slow-run notice (screen-slate.md) and the skeletons stay in place until results or an error arrive; the elapsed time is visible so the wait is never unexplained |

---

## EmptyState

An honest "nothing to show" with the reason and the next step. Used for an act with no data, a slate with no acts yet, and a city with zero heatmap cells.

| | |
|---|---|
| Element and role | `<section aria-labelledby>` with an `<h2>` or `<h3>` (level matches context), a reason paragraph, and an optional action button. Not a live region unless it replaces content that was just requested (then `role="status"`). |
| Props | `title: string`, `reason: string`, `reasonCode?: string`, `action?: { label: string; onClick }`, `compact?: boolean`, `icon: "unavailable"` |
| Look | neutral status colours, dash-circle icon, title in `--text-md`, reason in `--text-base`. Compact variant has no vertical padding beyond 16px (inside a card). |
| Copy rule | State what is missing, why (the reason code in words), and what the user can do. Never "Oops" or a bare "No results". Never show zero where there is no data. |
| Accessible name | its heading text |

| State | Behaviour |
|---|---|
| default | as above |
| hover | action button hover only |
| focus | ring on the action button |
| disabled | action disabled with reason while a retry is in flight |
| loading | the action becomes its loading state; the title stays |
| error | if the retry fails, the reason line is replaced by the new failure text and the live region says so |

---

## ErrorState

A failed run, request or load. States what failed, what was kept, and the way forward. Never a stack trace.

| | |
|---|---|
| Element and role | `<section role="alert">` for failures that replace expected content; `role="status"` for a non-blocking partial failure. One `<h2>`. |
| Props | `title: string`, `message: string`, `kept?: string` (what still works, for example "7 of 12 acts finished and are shown below"), `details?: { endpoint: string; httpStatus?: number; at: string }[]` (evidence of what failed), `retry?: () => void`, `secondaryAction?` |
| Look | error status colours with the octagon icon, never red text alone; actions are Buttons. Retry uses `aria-disabled` and `aria-busy` while in flight. |
| Details | a disclosure "What failed" lists failed calls as EvidenceRows (endpoint, time, status; no headers). |
| Accessible name | its heading |

| State | Behaviour |
|---|---|
| default | as above |
| hover | via Buttons |
| focus | on mount, focus moves to the heading when the error replaces the main content (route-level); for inline errors, focus stays where it was and the alert is announced |
| disabled | retry shows "Retrying…" with `aria-disabled` and `aria-busy` while in flight (never native `disabled`) |
| loading | retry in flight, as above |
| error | n/a (this is the error state); a repeated failure increments "Attempt 2" text |

---

## MatchPicker

Lets the user choose the right Qloo entity for one typed name. It is a single-choice group; nothing is preselected when more than one hit exists.

| | |
|---|---|
| Element and role | `<fieldset>` with `<legend>` "Which {typedName}?" and a radio group (`<input type="radio">` with `<label>`). Last option is always "None of these". |
| Props | `typedName: string` (plain text), `hits: { entityId: string; name: string; type: string; descriptor?: string; popularity?: number }[]` (names and descriptors are plain text), `value: string \| null`, `onChange`, `error?: string` |
| Option content | resolved name (`dir="auto"`, wraps), entity type word ("Artist"), descriptor if Qloo supplied one, otherwise the words "No description from Qloo", and "Qloo popularity rank {n} of 100 (higher is better known on Qloo)" when present (helps tell two Phoenix entries apart). |
| Option size | whole row is the label, minimum height `--target`, 8px gap. Selected row: `--accent-tint` background, 1px `--accent` border plus an inset 1px `--accent` ring (2px look, no layout shift) and a check icon plus the word "Selected" (not colour alone). |
| Accessible name | legend text; each radio is named by its label text (name plus descriptor). |

| State | Behaviour |
|---|---|
| default | no option selected when `hits.length > 1`. A single hit is never matched silently: it is a summary row with "Confirm", "Change" and "Remove" (see screen-match-confirmation.md) |
| hover | row background `--sunken` |
| focus | ring on the row (the radio's focus is displayed on the whole label) |
| disabled | n/a while choosing; read-only summary after the run starts |
| loading | skeleton rows while search results arrive |
| error | unselected at submit: legend-level error "Choose one match for {typedName}, or remove it." with `aria-describedby` on the fieldset and focus to the first radio |

---

## CityStrip

The lazy "other cities compared" list on act detail. Each city is a row (list), not a chart.

| | |
|---|---|
| Element and role | `<section aria-labelledby>` with `<h2>`; rows in `<ul aria-label="Cities compared">`. The loading region is `role="status"`. |
| Selection | The cities shown are the venue's city plus up to 4 others, taken from the slate's city list (ADR 0004: up to 5 heatmap calls per act, loaded lazily). They are not necessarily geographically near the venue; the section says so. |
| Props | `cities: { city: string; meanAffinityRank: number \| null; cellCount: number; thinData: boolean; isVenueCity: boolean; unavailable?: "zero-cells" }[]` (city is plain text), `status: "idle" \| "loading" \| "ready" \| "partial" \| "error"`, `progress: { done: number; total: number }`, `onRetry` |
| Row content | city name; mean affinity rank bar with the value printed ("0.847"); "{n} cells"; ThinDataBadge when `thinData`; a "Your venue's city" label on the venue city. |
| Order | cities with enough data sorted by mean affinity rank, highest first; then a sub-list headed "Thin data: read with caution" (cities under 15 cells), sorted by cell count then name. A single-cell city never sits among the ranked cities, even with a high mean. |
| Caption (fixed) | "Mean affinity rank is the average of Qloo's affinity rank (0 to 1) across a city's heatmap cells, shown with the number of cells behind it. It is a different scale from Fit and from Qloo popularity rank. Qloo rescales raw affinity and popularity inside each city, so cities are compared only by these two numbers." Second line: "Cities compared: your venue's city and up to 4 others from this slate's city list. They are not necessarily close to your venue." |
| Accessible name | "Audience strength in other cities compared" |

| State | Behaviour |
|---|---|
| default (idle) | not shown until the section nears the viewport; a "Load city strength" button is the fallback when scripts for observing are unavailable |
| hover | row background `--sunken` only for rows that open evidence |
| focus | ring on each row's "Evidence" link |
| disabled | button disabled with reason while loading |
| loading | rows appear as each city completes; the status line reads "Loading city strength: 2 of 5 cities"; remaining rows are skeleton lines |
| error | a city that failed shows an inline error row with the city name, "Could not load", and "Try again"; other cities stay. All failed: ErrorState compact. |

---

## ThinDataBadge

| | |
|---|---|
| Element and role | `<span>` containing icon + text. Optionally a disclosure button when a full explanation is allowed. |
| Props | `cellCount: number`, `threshold: 15` (fixed from ADR 0013), `variant: "inline" \| "block"` |
| Look | caution status pair, three-bars icon with a dotted last bar, text "Thin data" in `--text-sm` weight 600. Block variant adds the sentence below. |
| Copy | inline: "Thin data". Block: "Thin data: only {n} Qloo heatmap cells for this city (fewer than 15). The mean affinity rank may not be representative." |
| Accessible name | "Thin data, {n} cells" |

| State | Behaviour |
|---|---|
| default | as above |
| hover, disabled, loading, error | n/a: static label. It is shown whenever `cellCount < 15` (14 is thin, 15 is not), and never hidden to improve the look of a result. |
| focus | n/a (not focusable); the explanation is in text, not in a tooltip |

---

## Shared small parts

- **StandingLine**: caption "Qloo popularity rank", glyph, label, "{candidate} of 100 vs crowd median {median}" and "Higher is better known on Qloo." `role` none; accessible text: "Qloo popularity rank: below the crowd median, 86.4 out of 100 compared with a median of 99.5. Higher means better known on Qloo."
- **FitValue**: label "Fit", number, accessible text as in ActCard.
- **DerivedCaption**: the line "Derived from the Fit and Qloo popularity rank values above." shown under any number computed from other numbers (close-values note, tied note, comparison table), with a link "See evidence" to the Evidence trail of the acts involved.
- **ProgressStatus**: `<div role="status" aria-live="polite">` plus a visible `<progress>` with `max`, `value` and an `aria-label`. Updates the announcement at most every 2 seconds and always at completion.
- **ShareLinkField**: read-only TextField plus Button "Copy link"; on success a polite message "Link copied." for 4 seconds; on clipboard failure the field text is selected and the message reads "Copy failed. The link is selected; press Ctrl+C."
- **Icons**: the set in design-system.md section 7, all `aria-hidden`, never the only content.
