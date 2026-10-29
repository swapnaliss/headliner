# Screen: Room setup

Route (indicative): `/`. This is the first screen a hackathon judge sees. Built by M1-05. Uses [components](components.md): Banner, TextField, ActChip, Button, ErrorState. Tokens in [design-system.md](design-system.md). Next screen: [match confirmation](screen-match-confirmation.md).

## Purpose

Let a venue talent buyer describe the room in under a minute: a city, 3 to 6 acts the regular crowd already follows, and 3 to 12 acts under consideration, typed into the form or described in one sentence.

The first screen must explain itself to someone who has never heard of the product, in seconds. It therefore states, above the form and in plain words, what the tool does, what it will show, and what it will not claim. A judge who only wants to look can use the sample button and reach a real slate in three presses (fill the sample, check matches, rank).

Users and the job they came to do:

| User | Device and context | What this screen must do for them |
|---|---|---|
| Independent venue talent buyer (primary) | phone or laptop, between calls or at a desk, any language, any city; may type names with accents or non-Latin scripts | accept names as they think of them; tell them what happens next |
| Promoter or festival booker | laptop, planning several weeks ahead | same; paste a list of names |
| Artist manager | phone | check how an act fits a venue's crowd; same flow |
| Hackathon judge | laptop or phone, three minutes, no account | understand the product from the first screen, reach a slate with one press, see that no login is needed |

## Layout

Reading order and landmarks: skip link, `<header>` (wordmark + Demo-mode chip + Banner), `<main>` with one `<h1>`, `<footer>`. Content hierarchy, most important first: (1) what this is, (2) the two sample rooms ("start here"), (3) the form, (4) the primary action (always in view), (5) how it works, what you get, demo limits (quiet).

Type: h1 and h2 in the display face, wordmark display, everything else system sans (design-system.md section 2). Accent only on the wordmark mark, primary buttons, links and the selected state.

### Mobile 390px (works from 320px)

Single column, 16px gutters, 44px targets, 16px field text. Order: header, Banner, h1, lede, sample cards (stacked), "Or enter your own room below." and "Fill in the sample room" (secondary), form, How it works strip, What you get, Demo limits (closed). The ActionBar is a sticky bar at the bottom of the viewport when the viewport is at least 700px tall; otherwise it follows the form in the flow.

```
+--------------------------------------+
| [H] Headliner       [Demo mode chip] |  header, rule below
+--------------------------------------+
| (i) Audience-taste fit is aggregate  |  Banner (2 lines + What this means)
|     affinity, not a ticket forecast. |
+--------------------------------------+
| Rank the acts you are considering    |  h1, display
| by audience-taste fit                |
| Headliner compares each act's ...    |  lede
+--------------------------------------+
| Try a sample room                    |  h2, display
| Open a finished slate straight ...   |
| +----------------------------------+ |
| | Berlin electronic club, Berlin   | |  h3, 4px accent rule on top
| | Recorded real Qloo run, fetched  | |
| | 27 Oct 2026.                     | |
| | [ Open sample slate ]            | |  primary
| +----------------------------------+ |
| | Leipzig indie hall, Leipzig ...  | |
| +----------------------------------+ |
| Or enter your own room below.        |
| [ Fill in the sample room ]          |  secondary
+--------------------------------------+
| Your room                            |  h2
| Enter artist names and a city only.  |  privacy note
| ... City, crowd acts, chips, add ... |
| Acts you are considering ...         |
| > Describe it in one sentence        |
+--------------------------------------+
| How it works  1 Describe  2 Rank  3  |  compact strip
| What you get (muted paragraph)       |
| > Demo limits                        |  closed details
+--------------------------------------+
| [ Rank these acts ]                  |  ActionBar, sticky bottom
| Add a city, at least 3 crowd acts... |  reason
+--------------------------------------+
```

### Tablet 768px

One page column, 24px gutters. Sample cards side by side (two equal columns). The form sections stay stacked and full width. How it works becomes a three-column strip. The ActionBar is still a sticky bottom bar (below 1024px).

### Desktop 1280px

Content width 1280px including 32px gutters; 12 columns. Rows:

1. h1 and lede, columns 1 to 8.
2. "Try a sample room": heading and hint, then the two feature cards side by side across columns 1 to 8 (each 4 columns). They sit above the form so the first obvious thing to press is a card button.
3. Below, a two-column area: form in columns 1 to 8 ("Or enter your own room below.", "Fill in the sample room", "Your room", "Acts you are considering", the sentence disclosure); aside in columns 9 to 12 (sticky only at 1280px and above, when it is shorter than the viewport and the viewport is at least 700px tall; static at 1024px) holding, in order: the ActionBar card (button and reason), How it works (compact), What you get (muted), Demo limits (closed).

Because the ActionBar card is first in the aside and the aside is sticky, "Rank these acts" is on screen at the top of the right column as soon as the form begins, without scrolling a 1500px page. At 1024px (not sticky) the card is the first item of the aside beside the form and still in the first screenful of the form area. At 1440px the layout stays 1280px wide and centred.

```
+--------------------------------------------------------------------------------------+
| [H] Headliner                                                    [Demo mode chip]    |
| (i) Audience-taste fit is aggregate affinity, not a ticket forecast. It compares ... |
+--------------------------------------------------------------------------------------+
| Rank the acts you are considering by audience-taste fit                              |
| Headliner compares each act's audience with the artists your regulars follow, ...    |
|                                                                                      |
| Try a sample room                                                                    |
| +-----------------------------------+ +-----------------------------------+          |
| | Berlin electronic club, Berlin    | | Leipzig indie hall, Leipzig       |          |
| | Recorded real Qloo run, ...       | | Recorded real Qloo run, ...       |          |
| | [ Open sample slate ]             | | [ Open sample slate ]             |          |
| +-----------------------------------+ +-----------------------------------+          |
| Or enter your own room below.  [ Fill in the sample room ]                           |
|                                                           +------------------------+ |
| Your room                                                 | [ Rank these acts ]    | |
|  Enter artist names and a city only. ...                  | Add a city, at least 3 | |
|  City (required) [                          ]             | crowd acts and ...     | |
|  Crowd acts: 3 to 6 (required) ...                        +------------------------+ |
|                                                           | How it works  1 2 3    | |
| Acts you are considering ...                              | What you get ...       | |
| > Describe it in one sentence                             | > Demo limits          | |
+--------------------------------------------------------------------------------------+
| About and licence | Source on GitHub                                                 |
+--------------------------------------------------------------------------------------+
```

The wireframes use act names recorded in the project's sample fixtures (see ADR 0013); no live data is shown on this screen.

## States

| State | What the user sees | Behaviour |
|---|---|---|
| Empty (first visit) | Form empty, "Rank these acts" is `aria-disabled` with the reason "Add a city, at least 3 crowd acts and at least 3 candidate acts to continue." | Focus starts at the top of the page (skip link first). No auto-focus on a field, so screen readers read the h1 first. |
| Sample rooms (M2-06) | Section "Try a sample room" between the lead and the form: one feature card per pre-warmed room (see components.md, SampleRooms): h3 "{venue}, {city}", "Recorded real Qloo run, fetched {date}." and a primary button-link "Open sample slate" | A link opens the stored slate at `/s/sample-{slug}` with zero Qloo calls and no budget spent. Plain anchors (no prefetch). Tab order: after the lead, each card's button in order, then "Fill in the sample room". Hidden when the server has no sample rooms. |
| Sample filled | Form fields and chips are filled with the recorded sample room | Focus moves to "Rank these acts"; status message "Sample room filled in: Berlin, 6 crowd acts, 3 candidate acts. Check the entries, then press Rank these acts." |
| Typing / partially valid | Counters update ("4 of 6 added"). Reason line under the primary button updates to the first unmet requirement. | Counter text is not a live region (it would chatter); the reason line is `aria-describedby` on the button. |
| Adding an act | New chip appended; add field cleared and keeps focus | Live region (polite): "{name} added to crowd acts. 4 of 6." |
| Pasted list | Names split at commas or line breaks become chips; names over the limit are not added | Live region: "5 acts added. 1 skipped: more than 6 crowd acts." |
| At the limit | Add field becomes read-only with "Crowd acts are full (6). Remove one to add another." | Add button `aria-disabled` with reason linked |
| Validation error (on submit) | Error summary at top of form (heading "Fix 2 things to continue", links to each field) and message under each invalid field | Focus moves to the error summary. Messages are in the Copy table. |
| One-sentence: reading | Button shows "Reading…"; status "Reading your description" | `aria-busy` and `aria-disabled` while in flight; form stays usable |
| One-sentence: success | Fields and chips filled; note "We filled in the form from your description. Check each entry; nothing is ranked yet." | Focus to the note; user edits freely |
| One-sentence: partial | Only what was understood is filled; note lists what is missing | Focus to the note; missing fields get their normal required state |
| One-sentence: failed (LLM unavailable, spend cap reached, or unreadable) | Inline ErrorState (compact): "We could not read that description. The form above works without it." | Form untouched; no data lost |
| Submitting (matching) | "Rank these acts" shows "Ranking…" (`aria-busy`, `aria-disabled`, never native `disabled`), fields read-only | Status region: "Checking {n} names with Qloo" then navigates to match confirmation. Navigation moves focus to that screen's h1. |
| Qloo or network error | ErrorState above the primary button: "Could not reach Qloo. Your entries are kept. Try again." with Button "Try again" | Entries stay; focus to the ErrorState heading |
| Budget reached | ErrorState above the primary button (API code `demo_limit_reached`, HTTP 429): "This demo has reached its daily limit for live Qloo lookups. Your entries are kept. The sample rooms above still work, and the limit resets at midnight UTC." | Honest, no CAPTCHA, no login. The sample rooms (saved runs) are on the same page and cost nothing. |
| Demo limits note (M2-05) | A closed disclosure "Demo limits" in the aside under "What you get" (below the form at 768px and under; it opens in place, content unchanged): the per-visitor daily limit, that the sample rooms are always available, no login and no CAPTCHA | Always shown. In recorded-responses mode it says the limits are off in this demo and names the live limit |
| Offline | Notice: "You appear to be offline. Your entries stay on this page; reconnect to check matches." | Primary action keeps aria-disabled with this reason |
| Demo mode (recorded responses) | Chip at the right of the header row on every screen (drawn in every wireframe): "Demo mode: recorded Qloo responses" with info icon, plus the Demo-mode note under the lead | Shown whenever the server runs with recorded data. Names not in the recordings are reported on match confirmation with the dedicated message (not as an ordinary "no match") |
| Dark mode, 200% zoom, 320px | Same content, reflowed. The ActionBar is static (not sticky) at 200% zoom and at heights under 700px | See accessibility.md |

## Copy

Exact strings. Voice: plain, specific, no marketing. Wording rule: "audience-taste fit"; nothing that implies a prediction of sales or attendance.

| Element | String |
|---|---|
| Page title (`<title>`) | "Room setup: Headliner" (pattern "{page}: Headliner" on every screen) |
| Banner | "Audience-taste fit is aggregate affinity, not a ticket forecast. It compares the tastes of each act's audience with your regular crowd, using Qloo data. It says nothing about sales, attendance or any individual." (short form at 360px: first sentence + disclosure "What this means") |
| h1 | "Rank the acts you are considering by audience-taste fit" |
| Lead | "Headliner compares each act's audience with the artists your regulars already follow, using Qloo taste data, and shows the evidence behind every number." |
| Sample button | "Fill in the sample room" (secondary button) |
| Sample card button (new in the reskin; needs owner OK) | "Open sample slate" (accessible name "Open sample slate: {venue name}, {city}") |
| Sample rooms heading | "Try a sample room" |
| Sample rooms hint | "Open a finished slate straight away. These are saved runs: opening one makes no Qloo calls." |
| Sample room link | "{venue name}, {city}" (for example "Berlin electronic club, Berlin") |
| Sample room recorded line | "Recorded real Qloo run, fetched {d Mon yyyy}." |
| Sample hint | "A Berlin room with six crowd acts and three candidates, using recorded Qloo responses." |
| Section 1 heading | "Your room" |
| City label / hint | "City (required)" / "The city your regular crowd lives in." |
| Crowd label / hint | "Crowd acts: 3 to 6 (required)" / "Artists your regulars already follow." |
| Candidate label / hint | "Candidate acts: 3 to 12 (required)" / "Acts you are thinking of booking." |
| Add field label | "Add an act" (visually the same label, programmatically "Add a crowd act" / "Add a candidate act") |
| Add field hint | "Type one name and press Enter, or paste a list separated by commas or line breaks." |
| Add button | "Add" (accessible name "Add to crowd acts" / "Add to candidate acts") |
| Counter | "{n} of {max} added" |
| Sentence disclosure summary | "Describe it in one sentence" |
| Sentence label / hint | "Describe your room" / "For example: Leipzig club, our regulars follow Moderat, Apparat and Modeselektor, and we are considering Khruangbin and Radiohead." In the recorded-responses demo the hint instead says "This demo can read one recorded example sentence. Press Use the example sentence to try it, or fill in the form below yourself." and a quiet button "Use the example sentence" fills the field. |
| Sentence AI disclosure | "This description is sent to an AI model to read it. Do not include personal details. Nothing you type here is sent to Qloo except the artist names and city after you press Rank these acts." |
| Demo limits heading | "Demo limits" |
| Demo limits (live) | "To keep this demo free for everyone, each visitor gets {n} live Qloo calls a day. A cold room with 12 candidate acts used about 39 when we tested it, and names already looked up cost nothing. The limit resets at midnight UTC." |
| Demo limits (recorded responses) | "Daily limits are off in this recorded-responses demo: it makes no live Qloo calls. In the live demo each visitor gets {n} live Qloo calls a day." |
| Demo limits (both) | "The sample rooms are saved runs. They are always available and use none of those calls. No login, no CAPTCHA." |
| Demo-mode note | "This demo runs on recorded Qloo responses, so only artists in those recordings can be matched. The sample room always works." |
| Demo-mode name not recorded (shown after Rank these acts, on the next screen, and here if the server rejects the entry) | "This demo only has recorded responses and does not include {name}. Use the sample room or remove it." |
| Sentence button | "Read my description" / loading "Reading…" |
| Sentence success | "We filled in the form from your description. Check each entry; nothing is ranked yet." |
| Sentence partial | "We found a city but only 2 acts the crowd follows (3 needed) and no candidate acts. Add what is missing in the form; nothing is ranked yet." (counts only, never a name) |
| Sentence question | The model may ask one question; it is shown as plain text above a labelled field "Your answer" and the button "Send answer". The answer is sent once with the first description ("... Answer: ..."); a second question is never asked. |
| Sentence daily limit | "The daily limit for reading descriptions has been reached. The form above works without it, and the limit resets at midnight UTC." |
| Daily demo limit (ranking) | Heading "Daily demo limit reached"; the message names midnight UTC; the action is "Open a sample room" (no "Try again", which cannot succeed before the reset). |
| Sentence failure | "We could not read that description. The form above works without it." |
| Primary button | "Rank these acts" / loading "Ranking…" (in the ActionBar, always in view) |
| Disabled reason | "Add a city, at least 3 crowd acts and at least 3 candidate acts to continue." (the sentence names only what is still missing, for example "Add 2 more candidate acts to continue.") |
| Privacy note | "Enter artist names and a city only. Do not enter personal details." (now the first line of the "Your room" section, above the City field, so it is read before typing; the ActionBar holds only the button and the reason) |
| How it works heading | "How it works" |
| Steps | "1. Describe the room." "2. Rank the acts." "3. Read the ranked slate and the evidence behind each number." |
| What you get | "A ranked slate. Each act shows Fit, shared tastes, Qloo popularity rank, caveats and the Qloo calls behind every number." |
| Footer | "About and licence" / "Source on GitHub" |

Errors (shown under the field, with the error icon):

| Condition | String |
|---|---|
| City empty | "Enter the city your regular crowd lives in." |
| City too long | "City names are limited to 80 characters." |
| Name empty on Add | "Type an artist name first." |
| Name too long | "Artist names are limited to 80 characters." |
| Duplicate in the same list | "{name} is already in this list." |
| Same act in both lists | "{name} is already one of your crowd acts, so it cannot also be a candidate." |
| Crowd under 3 on submit | "Add at least 3 crowd acts. You have {n}." |
| Candidates under 3 on submit | "Add at least 3 candidate acts. You have {n}." |
| Over a limit | "You can add up to {max} acts here. Remove one to add another." |
| Sentence too long | "Keep the description under 400 characters." |
| Error summary heading | "Fix {n} things to continue" (singular: "Fix 1 thing to continue") |

Numeric limits (80 characters, 400 characters, 3 to 6, 3 to 12) are the design proposal; the shared zod input schema (ADR 0003) is the source of truth and the screen reads the limits from it.

## Keyboard and a11y

- Tab order: skip link, wordmark link, Banner disclosure, sample card buttons, "Fill in the sample room", city field, crowd add field, crowd Add button, each crowd chip's remove button, candidate add field, Add button, candidate chip removes, sentence disclosure (and its field and button when open), Rank these acts (the ActionBar; at 1024px and up it is earlier in DOM order, in the aside after the form, and in tab order after the form), How it works, Demo limits disclosure, footer links.
- Enter in an add field adds the act (it does not submit the form). Enter in the city field moves nothing. "Rank these acts" is the only submit.
- Landmarks: `header`, `main`, `footer`. Headings: h1 once; h2 for "Your room", "Acts you are considering", "How it works". The two act lists are `<ul>` with accessible names "Crowd acts" and "Candidate acts". The sample cards use h3 under the h2 "Try a sample room". The ActionBar is a named section "Rank these acts".
- Every field has a visible `<label>`; hints and errors are linked with `aria-describedby`; invalid fields set `aria-invalid`. On a failed submit, focus goes to the error summary, whose links move focus to the field.
- Live regions: one polite `role="status"` region for add/remove/sample/parse messages (messages queued, not stacked); errors use `role="alert"` only for the error summary and ErrorState.
- Names the user types, including right-to-left and non-Latin names, are shown in chips with `dir="auto"` and are never interpreted as HTML or markdown. Names over 24 characters are truncated visually; the full name is in the accessible name and in the edit field when the chip is activated.
- The form works without the one-sentence feature, with scripts that fail to load the intake island (a plain HTML form posts to the same route), and with no account, cookie banner or CAPTCHA.
- The one-sentence description is the only free text sent to a third-party AI model, and the disclosure above is shown next to its field before anything is sent.
- Dark mode and reduced motion follow the system. Targets are 44px below 768px.
- Autofill is off for act names (`autocomplete="off"`) and the city field uses `autocomplete="off"` too, because the city is the buyer's room city, not an address.

## Data source

Nothing on this screen is a computed score. Inputs build the request; the only server data is the sample and run status.

| Element | Source |
|---|---|
| City field and chips | user input -> `Room.city`, `Room.crowdActs[].name` (typed, unresolved until matching) |
| Candidate chips | user input -> candidate `Act.name` list for the run |
| Limits and counters | shared input schema (ADR 0003): crowd 3 to 6, candidates 3 to 12, name and city length |
| Sample room | recorded sample fixture (real Qloo-resolved names; no synthetic data) |
| One-sentence result | agent intake output, schema-validated, filling the same fields; the LLM produces strings only and no numbers |
| Demo mode chip | server config flag for recorded-response mode |
| "Rank these acts" result | creates a `Run` in state `matching`, then `awaiting_confirmation`; see [match confirmation](screen-match-confirmation.md) |
