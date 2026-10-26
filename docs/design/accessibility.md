# Accessibility checklist

Target: WCAG 2.2 level AA on every screen, at 320px, 360px, 768px and 1280px, light and dark. This list is built to by M1-05, M2-01, M2-02, M2-03 and M2-04, and audited by M3-06. Tokens and rules are in [design-system.md](design-system.md); component behaviour in [components.md](components.md).

How to use it: each item has an ID, a check, how to test it, and the screens it applies to (R room setup, M match confirmation, S slate, D act detail, SH shared slate). M3-06 records pass or fail per item and per screen in `docs/evidence/`. A failing item blocks the milestone gate.

## 1. Page structure and navigation

| ID | Check | How to test | Screens |
|---|---|---|---|
| A-01 | Skip link "Skip to main content" is the first focusable element, becomes visible on focus, moves focus to `main`. | Keyboard: load page, press Tab once | all |
| A-02 | Landmarks: one `header`, one `main`, one `footer`; `aside` only where specified; the Banner is inside `header`. | Screen reader landmark list; axe `landmark-*` rules | all |
| A-03 | One h1 per page; heading levels do not skip; headings describe their section. | Heading outline in a screen reader or browser extension | all |
| A-04 | Each page has a unique `<title>` of the form "{page}: Headliner". | View source on each route | all |
| A-05 | `lang` is set on `<html>`; entity names carry `dir="auto"`; a name in another script does not reorder the surrounding sentence. | Inspect; test with a right-to-left name and a CJK name | all |
| A-06 | Focus management on route change: after a client-side navigation, focus moves to the new page's h1 (`tabindex="-1"`), the title updates, and the change is announced by the move itself (no extra alert). Back navigation restores the previous scroll position and focus where the browser can. | Keyboard and screen reader: R to M to S to D and back | R, M, S, D |
| A-07 | Tab order follows visual order; no positive `tabindex`; the desktop aside comes after the main column in DOM and tab order. | Tab through each screen at 360px and 1280px | all |
| A-08 | No keyboard trap; disclosures, radios and tables are operable with the keyboard alone (Enter, Space, Arrow keys). | Unplug the mouse and complete the whole journey | all |
| A-09 | Anchor targets (`#evidence`, `#ev-n`) receive focus and show the visible target outline and the "Linked from above" text. | Activate each "See evidence" link by keyboard | D |

## 2. Forms and errors

| ID | Check | How to test | Screens |
|---|---|---|---|
| F-01 | Every input has a visible `<label>`; placeholders are never the only label. The add-act fields have distinct accessible names for crowd and candidate. | Accessibility tree; axe `label` | R, M |
| F-02 | Hints and error messages are associated with `aria-describedby`; invalid inputs set `aria-invalid="true"`. | Screen reader reads label, hint, then error | R, M |
| F-03 | On failed submit, focus moves to an error summary whose links move focus to each invalid field. Error text says what is wrong and how to fix it. | Submit an empty form; follow each link | R, M |
| F-04 | Required fields say "required" in text, not only with a symbol. | Read labels | R |
| F-05 | Autocomplete is off for act and city names; input font size is 16px or more. | Inspect; test on a phone | R, M |
| F-06 | Radio groups use `fieldset` and `legend`; no option is preselected when a name is ambiguous; arrow keys move within the group. | Keyboard and screen reader on a name with several hits | M |
| F-07 | A control that is unavailable because of missing input uses `aria-disabled` with a visible, associated reason; native `disabled` is not used; in-flight buttons use `aria-busy` with `aria-disabled`. | Tab to the Rank / Check matches buttons while incomplete | R, M |
| F-08 | Removing a chip or an act announces the result and moves focus to a sensible neighbour, never to the page top. | Remove each kind of item with the keyboard | R, M |
| F-09 | Input is not lost on error, timeout or going offline. | Break the network mid-submit | R, M |

## 3. Live regions and async states

| ID | Check | How to test | Screens |
|---|---|---|---|
| L-01 | Progress ("Scoring 12 acts: 5 of 12 done") is in one `role="status"` region updated at most every 2 seconds and at completion; per-act changes are not announced individually. | Screen reader during a run; count announcements | M, S, D |
| L-02 | Errors that replace content use `role="alert"` or move focus to the error heading; non-blocking errors use `role="status"`. | Force a failed run and a failed city load | S, D |
| L-03 | The live region exists in the DOM before its content changes. | Inspect on load | M, S, D |
| L-04 | Skeletons are `aria-hidden`; the container sets `aria-busy` while loading and clears it after. | Inspect during load | S, D |
| L-05 | Loading never shows a spinner without text saying what is loading; slow loads show the "Still working" message. | Throttle the network | M, S, D |
| L-06 | Copy-to-clipboard result is announced ("Link copied.") and has a fallback. | Deny clipboard permission | S |
| L-07 | Every state in the screen specs (empty, loading, partial, error, no data, thin data, stale, offline) has been rendered and checked. | Walk the States table of each screen | all |

## 4. Colour, contrast and non-colour cues

| ID | Check | How to test | Screens |
|---|---|---|---|
| C-01 | Contrast re-check: `node scripts/check-contrast.mjs docs/design/design-system.md` prints no FAIL and exits 0. | Run the script; attach the output to the audit | all |
| C-02 | The CSS custom properties in the shipped `tokens.css` equal the hex values in design-system.md (light and dark). | Compare the two (M1-05 adds an automated test) | all |
| C-03 | Real rendering is spot-checked with a browser contrast tool on: Banner text and border, link in body copy, chip border, input border, focus ring on each surface, selected row, thin-data bar, error text. | Browser devtools | all |
| C-04 | Status is never colour alone: each caveat, error, unavailable, thin-data and standing state shows an icon and a text label. | View each state in greyscale and with a colour-blindness simulator | all |
| C-05 | Links in running text are underlined; link text is not "click here". | Visual check | all |
| C-06 | The standing glyph is not an arrow, and neither colour nor shape implies good, bad or a trend. | Visual check of Above, Similar, Below | S, D |
| C-07 | Dark mode and `data-theme` override both pass the same checks. | Repeat C-01 to C-06 in dark | all |
| C-08 | Windows forced-colors mode: borders, focus ring, icons (via `currentColor`) and the hatch remain visible. | Enable high contrast in Windows or emulate in devtools | all |

## 5. Focus appearance and target size

| ID | Check | How to test | Screens |
|---|---|---|---|
| T-01 | Every focusable element shows the 3px `--focus` ring with 2px offset; no element removes the outline without replacement. | Tab through every screen | all |
| T-02 | Focus is never hidden behind sticky UI; headings and targets set `scroll-margin-block`. | Tab to elements near the sticky aside | M, S |
| T-03 | Target size: at least 44 by 44 CSS px below 768px and for coarse pointers; at least 32 by 32 on desktop; never below 24 by 24 (WCAG 2.5.8). Adjacent targets are at least 8px apart. | Measure in devtools; includes chip remove buttons (chip rows have a 12px gap or 44px row height) and \"Change\" | all |
| T-04 | Controls are not operated by hover alone; nothing important appears only on hover or pointer drag. | Use touch emulation | all |

## 6. Motion, zoom, reflow and text

| ID | Check | How to test | Screens |
|---|---|---|---|
| Z-01 | `prefers-reduced-motion: reduce`: no animation or transition longer than 0.01ms; skeleton static; bars at final width; information unchanged. | Emulate the media feature | all |
| Z-02 | Nothing flashes more than three times per second; nothing blinks. | Visual check | all |
| Z-03 | 200% browser zoom and 200% text-only size: no loss of content or function, no overlapping, no truncation of required information. | Zoom to 200% at 1280px width; set a large default font size | all |
| Z-04 | Reflow: no horizontal scroll at 320 CSS px width, except inside a labelled, focusable table container when a single unbreakable string needs it (WCAG 1.4.10). | Resize to 320px; check every screen and the longest names | all |
| Z-05 | Text spacing override (line height 1.5, paragraph 2em, letter 0.12em, word 0.16em) causes no loss. | Apply the WCAG text-spacing bookmarklet | all |
| Z-06 | The viewport does not disable zoom (`user-scalable` is not set to no, no `maximum-scale`). | Inspect meta viewport | all |
| Z-07 | Orientation is not locked; the layout works in landscape on a phone. | Rotate | all |

## 7. Content, names and language

| ID | Check | How to test | Screens |
|---|---|---|---|
| N-01 | Untrusted strings (act names, tag labels, cities, descriptors, evidence parameters) render as plain text: a name containing `<b>`, `&amp;`, a markdown link or a URL stays literal and creates no element or link. | Enter such names in a test; M2-04 repeats it on the shared page | R, M, S, D, SH |
| N-02 | Right-to-left, CJK, accented and combining-character names display correctly and are readable by a screen reader; very long names wrap or truncate with the full name available. | Test with Arabic, Hebrew, Japanese, Björk, Sigur Rós and a 200-character name | all |
| N-03 | The Banner "aggregate affinity, not a ticket forecast" appears on every screen and is not dismissible. | Visit every route, including errors and the shared page | all |
| N-04 | Banned words absent: the validation command in the M1-04 ticket (grep) passes on `docs/design/` and an equivalent grep passes on the rendered UI strings. | Run the grep; search the build's strings | all |
| N-05 | No claim of momentum, growth or trend; standing is captioned "Qloo popularity rank". | Read every string | S, D |
| N-06 | Unavailable and no-data states state the reason; no zero or blank stands in for missing data. | Trigger each reason code | S, D |
| N-08 | Three scales are never mixed: Fit is 0 to 100, Qloo popularity rank is shown "of 100" with "higher is better known on Qloo", mean affinity rank is 0 to 1. Compared orders use "Fit position" and "Popularity position". | Read every number in context | S, D |
| N-09 | Names inside `aria-label` and live-region strings are wrapped in Unicode isolates; a right-to-left name does not reorder the sentence. | Screen reader with a right-to-left name | all |
| N-07 | Images and icons: decorative icons are `aria-hidden`; any icon that carries meaning has an adjacent text label. There are no images of data. | Accessibility tree | all |

## 8. Automated and manual tooling for the audit (M3-06)

- Automated: axe-core (via the project's chosen runner) on every route in each state fixtures can reproduce, in light and dark, at 360px and 1280px. Zero serious or critical violations.
- Keyboard-only run of the demo storyboard: room setup, matches, slate, act detail, share link.
- Screen reader pass: NVDA with Firefox or Chrome on Windows, VoiceOver with Safari on iOS. Record which was used.
- Contrast: C-01 output attached.
- Result file: `docs/evidence/a11y-audit.md` with one row per item, the date, the build tested, and any waiver with a reason. Findings are fixed or logged to the backlog before the gate.
