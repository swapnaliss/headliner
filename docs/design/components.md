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

## Header and wordmark

First element of every screen, above the Banner. Replaces the plain text "Headliner".

| | |
|---|---|
| Element and role | `<header>` containing a row: `<a href="/" class="brand">` and, on the right, the Demo-mode chip (info status) when the server runs recorded data. The Banner follows inside the same `<header>`. |
| Wordmark | The word "Headliner" in `--font-display` weight 700, `--text-lg` on mobile and `--text-xl` from 768px, `--text` colour, `letter-spacing: -0.01em`. Preceded by the mark. |
| Mark | Inline SVG, 24px square, `aria-hidden="true"`, `fill: var(--accent)` (a rounded 4px square) with a lettershape "H" cut out in `--canvas`, the crossbar sitting above the middle so the shape reads as "top of the bill". Flat, no gradient, no raster, no animation. Decorative: the link's accessible name is the text "Headliner". Mark on canvas 3:1 is in the contrast tables. |
| Rule | The header row has a 1px `--border-subtle` rule under it (decorative). Nothing else in the header: no navigation, no search, no account. |
| Targets | Link hit area at least `--target` tall; 8px from the Demo-mode chip. |

| State | Behaviour |
|---|---|
| default | as above |
| hover | wordmark underline (2px, `--accent`) |
| focus | 3px ring around mark and wordmark together |
| disabled, loading, error | n/a |

---

## Button

One hierarchy, defined here and used everywhere. A control is never both boxed and underlined.

| Level | Look | Use | Code value |
|---|---|---|---|
| Primary | filled `--accent`, `--on-accent` text, no border, `--radius-1`, weight 600 | the one action the region exists for: "Rank these acts", "Open sample slate". At most one per region; a screen may have a primary per region (the sample cards and the action bar are different regions) | `variant="primary"` |
| Secondary | `--surface` fill, 1px `--accent` border, `--accent` text, weight 600 | a real alternative or a supporting action: "Fill in the sample room", "Add to crowd acts", "Copy link", "Try again" | `variant="secondary"` |
| Tertiary | no fill, no border, `--accent` text, always underlined (2px offset), weight 600, same hit area as other buttons | navigation-like or low-stakes actions and every link inside a card or sentence: "Evidence (12 calls)", "Use the example sentence", "Change room" | `variant="quiet"` (code name kept; the spec calls it tertiary) |

| | |
|---|---|
| Element and role | `<button>` for actions, `<a>` styled as a button for navigation. Role is implicit. |
| Props | `variant: "primary" \| "secondary" \| "quiet"`, `children: string`, `loading?: boolean`, `loadingLabel?: string`, `disabledReason?: string`, `type`, `onClick`, `icon?: IconName` (decorative) |
| Size | minimum height and width `--target` (44px on small screens). Padding inline 20px. Label `--text-base`, weight 600. Labels are verbs: "Rank these acts", not "Submit". |
| Accessible name | its visible text (plus `aria-label` only when the visible text is not enough to tell two buttons apart, and then the label must start with the visible text, WCAG 2.5.3). |

| State | Behaviour |
|---|---|
| default | as the table above |
| hover | primary: `--accent-hover` fill. secondary: `--accent-tint` fill. tertiary: text becomes `--accent-hover`. The border, fill or underline already says "clickable"; hover is never the only cue. |
| focus | 3px focus ring, 2px offset, on every level. |
| disabled | A control that is unavailable because of missing input uses `aria-disabled="true"` (not the `disabled` attribute) so it stays focusable and can be explained; activating it does nothing except move focus to the first thing that needs fixing and announce the reason. The reason sits visibly under or beside the button and is linked with `aria-describedby`. Look: `--sunken` fill, `--text-muted` text and a solid 1px `--border-control` border (never dashed). The disabled look is the same for primary and secondary, and it is plainly not the accent, so a disabled primary does not look available. Text 6.7:1 (light) and 8.5:1 (dark) and border 4.8:1 and 5.3:1 meet AA (design-system.md contrast tables), so the button stays legible even though disabled controls are exempt from WCAG contrast. The native `disabled` attribute is not used at all, so focus is never lost. |
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
| Spacing | chips in a list have a 12px gap in both directions (row gap 12px, so remove-button hit areas never overlap); below 768px each chip row is at least 44px tall; chips wrap at 360px |
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

One candidate act on the slate. Rendered as `<li>` inside `<ol aria-label="Ranked acts">` (order matters, so an ordered list). The card is one flat bordered unit with one primary affordance. Cards are never nested.

| | |
|---|---|
| Element and role | `<li><article aria-labelledby="{id}-name">`. The act name is an `<h3>` (plain text, `--font-sans`). |
| Props | `rank: number \| null`, `name: string` (plain text), `fit: { value: number } \| { unavailable: FitReason }`, `overlapTags: { label: string; score: number }[]` (first 3 shown), `standing: { label: "above"\|"similar"\|"below"; candidatePercentile: number; crowdMedian: number } \| { unavailable: StandingReason }`, `caveats: Caveat[]`, `evidenceHref: string`, `detailHref: string`, `tiedWithPrevious?: boolean`, `state: "ready" \| "no-data" \| "loading"` |
| Grid | One flat CSS grid per card, so the rank numeral is the left-hand hero at every width. Below 768px: columns `3rem 1fr auto`; row 1 rank, name, Fit; then tags and count, standing, caveats and the footer, each full width, 16px apart. From 768px: columns `4.5rem 1fr auto`; rank spans the tags and standing rows; rows are `rank name fit`, `rank tags tags`, `rank standing standing`, then caveats and footer across the full card. The standing block is one wrapping row (caption, glyph chip, "{n} of 100 vs crowd median {m}", scale note), so no column is squeezed; the tags and the shared-taste count share one wrapping row. A no-data card is `rank name`, then the compact empty state (no border of its own inside the card), caveats, footer. |
| Content order (top to bottom) | head row: rank numeral, act name, Fit (right edge). Body: overlap tag chips and the count line "{n} shared tastes with your crowd"; standing block (caption "Qloo popularity rank", glyph and label, "{n} of 100 vs crowd median {m}", "Higher is better known on Qloo."). Caveat chip, then its sentence once. Footer: the primary link "Open details" and the one quiet secondary link "Evidence (n calls)". |
| Rank (the hero) | A numeral in `--font-display` 700, `--accent` colour, `--text-2xl` (40px) below 768px and `--text-3xl` (56px) from 768px, lining and tabular figures, in a column of fixed width (3rem / 4.5rem) so the numerals align down the left edge. Plain text, no box, no circle. Accessible: `aria-label="Rank 2 of 5"` on the numeral. Unranked acts show "Not ranked" in `--text-sm` weight 600, `--text-muted`, in the same column (no number, no dash alone). |
| Fit | Label "Fit" at `--text-xs` (13px), weight 600, in `--text` (full contrast), right-aligned above the number; the number in `--font-sans` weight 600, `--text-xl`, tabular, one decimal, `--text` colour. It is lighter and smaller than the rank on purpose: rank leads, and the rank numeral is the only number set in the display face. No bar, ring, gauge, star, sparkline or percent sign (design-system.md section 8). Accessible text: "Audience-taste fit 60.6 out of 100". If `tiedWithPrevious`, the neutral note "Same Fit as the act above; ordered by name." |
| Overlap tags | up to 3 chips (plain-text labels, `--font-sans`, not links). The card no longer carries a "See all {n} shared tastes" link: the full list is on the detail page, which the card opens, and the count stays in the line "{n} shared tastes with your crowd". |
| Standing | as before: caption always "Qloo popularity rank"; glyph plus label; "86.4 of 100 vs crowd median 99.5"; "Higher is better known on Qloo." Similar means within 5 percentile points of the median. Neutral colours, no arrows. If unavailable: neutral chip "Unavailable" with the reason. |
| Caveats | one Caveat chip per kind (see Caveat chip). The chip names the cities ("Thin data: Berlin, Leipzig"); the sentence under it appears once. |
| Primary affordance | The text link "Open details" (tertiary style, trailing chevron icon, accessible name "Open details for {name}") is a stretched link: its `::after` covers the whole card (`position: absolute; inset: 0`, card is `position: relative`), so the whole card is the click and tap target. Right-to-left: the chevron mirrors. |
| Secondary affordance | At most one: "Evidence (12 calls)" (singular "Evidence (1 call)"), tertiary style, `position: relative; z-index: 1` so it sits above the stretched link, going to `{detailHref}#evidence`. Accessible name "Evidence for {name}, 12 calls". Hit area `--target`; at least 8px from the primary link. |
| Accessible name | the heading "{name}". Each section is announced in reading order; Fit and standing are plain text. |

| State | Behaviour |
|---|---|
| default | as above; 1px `--border-subtle` border on `--surface`, `--radius-2`, padding 20px (24px from 768px) |
| hover | border becomes `--accent` (1px) plus an inset 1px `--accent` ring (2px look, no layout shift); the "Open details" underline thickens. Nothing is revealed only on hover. |
| focus | when "Open details" is focused, its `::after` draws the 3px focus ring around the whole card (2px offset); "Evidence" has its own ring. Both visible without hover. |
| disabled | n/a |
| loading | replaced by SkeletonCard (the slate shows progress, not partial ranks) |
| error / no data | The card keeps its place in the "Not ranked" group and shows an EmptyState (compact) in place of Fit and tags: "No data" with the reason, and a button "Try this act again". Caveat chip "No data" is present. No stretched link when there is no detail page. |

Text inside a stretched card cannot be selected by dragging from the link area; this is accepted (names and numbers are also on the detail page and in the Evidence).

Layout: below 768px, one column: head row `[rank | name | Fit]`, then tags, standing, caveat, footer, all full width with 16px between. From 768px: two columns inside the card under the head row (tags and count left, standing right). At 1280px the card is `grid-template-columns: 4.5rem 1fr 11rem`: rank, then name with tags and count underneath, then Fit over standing at the right; the caveat and footer span the full width below. See screen-slate.md.

---

## Caveat chip

A short flag attached to a card or a section explaining a limit on the number next to it. Always icon plus text.

| | |
|---|---|
| Element and role | `<li>` in a `<ul aria-label="Caveats">`, or a `<span>` when single. Plain text; no role override. |
| Props | `code: CaveatCode`, `label: string` (fixed per code), `detail?: string` (full sentence, shown on the detail page and in a disclosure on cards), `severity: "caution" \| "unavailable" \| "info"` |
| Look | `--radius-pill`; icon (triangle for caution, dash circle for unavailable, i circle for info) + label in `--text-sm` weight 600; colour pair from the status table. |
| Codes and labels | `thin-data` "Thin data" (as built, slate cards also show it with the city names; the earlier rule that only the detail page shows it is superseded); `fit-unavailable` "Fit unavailable"; `standing-unavailable` "Popularity rank unavailable"; `low-match-confidence` "Match chosen by you"; `no-data` "No data"; `stale-cache` "Saved result"; `partial-run` "Run incomplete" |
| Several cities | When the same caveat applies to more than one city (thin data for Berlin and Leipzig) there is **one chip** whose label names them, "Thin data: Berlin, Leipzig", and the sentence is shown **once**: the merged caveat message is the de-duplicated list of the individual messages (identical sentences collapse to one), never the messages joined. City names inside the chip are plain text in `<bdi>`. |
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
| Selection | The cities shown are the venue's city plus up to 4 others, made of fixed defaults (London, Leipzig, Jakarta, Tromsø) plus cities the reader adds, 5 in all (ADR 0004: up to 5 heatmap calls per act, loaded lazily; owner decision 2026-10-27, the slate has no city list). They are not necessarily geographically near the venue; the section says so. |
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

## SampleRooms (feature cards)

"Try a sample room" on room setup. The recommended first step, so it is a "start here" row of cards, not a list of small links.

| | |
|---|---|
| Element and role | `<section aria-labelledby="samples-heading">` with an `<h2>`; the hint paragraph; `<ul>` of two cards, each `<li><article>` with an `<h3>`. Hidden when the server has no sample rooms. Plain anchors, no prefetch. |
| Card content | `<h3>` "{venue name}, {city}" in `--font-display` 600, `--text-lg` (the venue name is our recorded fixture copy and stays in the display face; the city is an entity, so it is wrapped in `<bdi class="entity">` and set on its own line below the venue name in the system stack, `--text-sm` weight 600 `--text-muted`, with a visually hidden ", " between them so the heading still reads "{venue name}, {city}"); one line "Recorded real Qloo run, fetched {d Mon yyyy}." in `--text-sm` `--text-muted`; a primary button-link "Open sample slate", full width of the card and at least 44px tall, aligned to the foot of the card, accessible name "Open sample slate: {venue name}, {city}". The card is not itself a link, so there is exactly one affordance. |
| Look | `--surface`, 1px `--border-subtle`, `--radius-2`, padding 24px, a 4px `--accent` rule on the block-start edge. No image, no illustration. |
| Layout | two equal columns from 768px, stacked below; each card at least 8px apart. |

| State | Behaviour |
|---|---|
| default | as above |
| hover | the button hovers; the card does not change |
| focus | ring on the button |
| disabled, loading | n/a (navigation; the next page owns loading) |
| error | n/a; when no samples exist the section is absent and the form is the first block |

---

## ActionBar (room setup primary action)

The "Rank these acts" button with its reason, kept in view. Replaces the full-width button at the end of the form.

| | |
|---|---|
| Element and role | A `<section aria-label="Rank these acts">` holding the Button (type submit, `form="room-form"` so it lives outside the form element), the reason paragraph (linked with `aria-describedby`, `id="rank-reason"`) and nothing else. It sits in the aside at 1024px and above (a card, sticky from 1280px under the existing sticky-aside rule) and is a bar at the bottom of the viewport below 1024px. |
| Bar (below 1024px) | `--surface` fill, 1px `--border-subtle` top rule, padding 12px by the gutter, safe-area inset added. Button full width, then the reason in `--text-sm` under it. **While the form is empty** (no city, no act and nothing typed in an add field) the bar is an ordinary block after the form: a sticky bar over a still-empty first screen would cover the sample-room cards, which are the first thing to press, and a disabled button needs no persistence. **Once anything has been entered** (`data-started="true"`) and the viewport is at least 700px tall (`@media (min-height: 700px)`) it becomes `position: sticky; inset-block-end: 0` with `--shadow-1`, so Rank is always reachable while the form is being filled. It is static at 200% zoom and 320px by the same height rule, and the page sets `scroll-padding-block-end` to the bar height (9rem, an upper bound) only while it sticks, so a focused field is never covered (WCAG 2.4.11). It is a direct sibling of the form wrapper in the page flow (the aside wrapper is `display: contents` below 1024px and carries no landmark role) so it can stick against the whole page. |
| Card (1024px and up) | `--surface`, 1px `--border-subtle`, `--radius-2`, padding 24px; the button full width of the card. First item of the right column, so the action is on screen with the form at 1280px. |
| Behaviour | `aria-disabled` pattern unchanged: activating it while blocked moves focus to the first thing that needs fixing, announces the reason, and the reason text stays visible next to the button. States and strings are those in screen-room-setup.md. |
| Never | a second "Rank these acts" button elsewhere on the page. |

---

## ExplanationBlock (disclosure)

The generated explanation on the slate, now secondary content.

| | |
|---|---|
| Element and role | `<section aria-labelledby="explanation-heading">` placed after "Ranked acts" and "Not ranked", before the footer. The section is a quiet bordered row (`--surface`, 1px `--border-subtle`, `--radius-2`, padding 16px) so it reads as a section, not an inline link. Inside: a `<details>` (closed by default, also when the model text replaces the template) whose `<summary id="explanation-heading">` is a leading chevron icon (accent) plus "Explanation", `--text-md` weight 600 in `--text` (underlined on hover), the chevron rotating 90 degrees when open (only when reduced motion is not requested), hit area `--target`. The provenance line "Written from checked facts. Every figure in this text was checked against this slate before it was shown." (or "Template. Built from this slate's values by a fixed template; no figure is added.") stays visible beside the summary in both states, so the honesty cue never hides with the prose. The paragraphs sit inside the `<details>` unchanged: same sentences, same order, `dir="auto"`, max 70ch. |
| Behaviour | Native disclosure, works without scripts. Keyboard: Enter and Space on the summary. The act detail page keeps its own Explanation block unchanged in this reskin (one act, short). |
| State | default closed. Open: content shown, `open` attribute. Pending (template while the model text loads): provenance line says "Template." and nothing is announced. |

---

## Quiet side cards (room setup)

The three right-hand blocks, now clearly secondary to the form and the action card.

| Block | Treatment |
|---|---|
| How it works | A compact three-step strip, not a card: `<ol>` with the three existing sentences, each step led by a small numeral in `--font-display` `--accent`. Below 768px stacked; from 768px a three-column strip; in the aside it is a single column of three short rows. `--text-sm`, no border, no background. h2 "How it works" in `--text-md` sans weight 600 (a quiet heading, an exception to the display h2 rule noted here: it is a label, and the page already has an h1 and display h2s). |
| What you get | Plain paragraph under a `--text-md` label, `--text-sm`, `--text-muted`, no border. |
| Demo limits | `<details>` closed by default; summary "Demo limits" (`--text-md` sans 600, tertiary-underlined). Content unchanged. A closed `<details>` keeps the section findable but never competes with the action. |
| Common | no `--surface` fill, no shadow; separated by a 1px `--border-subtle` rule on the block-start edge. |

---

## Shared small parts

- **StandingLine**: caption "Qloo popularity rank", glyph, label, "{candidate} of 100 vs crowd median {median}" and "Higher is better known on Qloo." `role` none; accessible text: "Qloo popularity rank: below the crowd median, 86.4 out of 100 compared with a median of 99.5. Higher means better known on Qloo."
- **FitValue**: label "Fit", number, accessible text as in ActCard.
- **DerivedCaption**: the line "Derived from the Fit and Qloo popularity rank values above." shown under any number computed from other numbers (close-values note, tied note, comparison table), with a link "See evidence" to the Evidence trail of the acts involved.
- **ProgressStatus**: `<div role="status" aria-live="polite">` plus a visible `<progress>` with `max`, `value` and an `aria-label`. Updates the announcement at most every 2 seconds and always at completion.
- **ShareLinkField**: read-only TextField plus Button "Copy link"; on success a polite message "Link copied." for 4 seconds; on clipboard failure the field text is selected and the message reads "Copy failed. The link is selected; press Ctrl+C."
- **Icons**: the set in design-system.md section 7, all `aria-hidden`, never the only content.
