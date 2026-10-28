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

Reading order and landmarks: skip link, `<header>` (product name + Banner), `<main>` with one `<h1>`, `<footer>`. Content hierarchy, most important first: (1) what this is, (2) the sample button, (3) the form, (4) the primary action, (5) how it works, (6) limits and privacy note.

### Mobile 360px

Single column, 16px gutters, 44px targets, 16px field text. The form is above the "How it works" list so the action is reachable without scrolling past an explanation, but the one-line explanation stays above the form.

```
+--------------------------------------+
| Headliner        [Demo mode chip]    |  header
+--------------------------------------+
| (i) Audience-taste fit is aggregate  |  Banner (2 lines)
|     affinity, not a ticket forecast. |
|     > What this means                |
+--------------------------------------+
| Rank the acts you are considering    |  h1
| by audience-taste fit                |
| Headliner compares each act's        |  lead, text-base
| audience with the artists your       |
| regulars already follow, using Qloo  |
| taste data, and shows the evidence   |
| behind every number.                 |
| [ Fill in the sample room ]          |  secondary button
| A Berlin room, recorded responses.   |  sample hint
+--------------------------------------+
| Your room                            |  h2
| City (required)                      |
| [ Berlin                           ] |
| Hint: the city your regulars live in |
|                                      |
| Crowd acts: 3 to 6 (required)        |
| Artists your regulars already follow |
| ( Apparat x ) ( Moderat x ) ...      |  ActChips
| [ Add an act                  ][Add] |
| 6 of 6 added                         |
+--------------------------------------+
| Acts you are considering             |  h2
| Candidate acts: 3 to 12 (required)   |
| ( Khruangbin x ) ( Radiohead x ) ... |
| [ Add an act                  ][Add] |
| 3 of 12 added                        |
+--------------------------------------+
| > Describe it in one sentence        |  details
+--------------------------------------+
| [ Rank these acts ]                    |  primary, full width
| Enter artist names and a city only.  |
+--------------------------------------+
| How it works                         |  h2
| 1. Describe the room                 |
| 2. Rank the acts                     |
| 3. Read the ranked slate and its     |
|   evidence                           |
+--------------------------------------+
| About and licence | Source on GitHub |  footer
+--------------------------------------+
```

The sentence disclosure, when open, shows a labelled multi-line field (3 rows) and the Button "Read my description" above the form fields' primary action.

### Desktop 1280px

Content width 1280px including 32px gutters; 12 columns. Two columns: the form takes columns 1 to 7; an aside on columns 9 to 12 (sticky only at 1280px and above, when it is shorter than the viewport and the viewport is at least 700px tall; static at 1024px; below the form at 768px; at 1440px the layout stays 1280px wide and centred) holds "How it works" and "What you will get". The h1 and lead span columns 1 to 8. Sample button sits beside the lead. The two act lists are stacked in the form column, with the add fields at 100% of the column.

```
+--------------------------------------------------------------------------------------+
| Headliner                                                    [Demo mode chip]        |
+--------------------------------------------------------------------------------------+
| (i) Audience-taste fit is aggregate affinity, not a ticket forecast. It compares ... |
+--------------------------------------------------------------------------------------+
| Rank the acts you are considering by audience-taste fit          | How it works      |
| Headliner compares each act's audience with the artists your     | 1. Describe       |
| regulars already follow, using Qloo taste data, and shows the    | 2. Confirm matches|
| evidence behind every number.   [ Fill in the sample room ]      | 3. Read the slate |
| A Berlin room with six crowd acts and three candidates, recorded |                   |
|                                                                  |                   |
| Your room                                                        | What you get      |
|   City (required)  [ Berlin                          ]           | A ranked slate.   |
|   Crowd acts: 3 to 6 (required)                                  | Each act shows    |
|   ( Apparat x ) ( Moderat x ) ( Modeselektor x ) ...             | Fit, shared       |
|   [ Add an act                              ] [ Add ]            | tastes, Qloo      |
| Acts you are considering                                         | popularity rank,  |
|   ( Khruangbin x ) ( Radiohead x ) ( Reality Club x )            | caveats and the   |
|   [ Add an act                              ] [ Add ]            | Qloo calls behind |
| > Describe it in one sentence                                    | every number.     |
| [ Rank these acts ]                                                |                   |
+--------------------------------------------------------------------------------------+
| About and licence | Source on GitHub                                                 |
+--------------------------------------------------------------------------------------+
```

The wireframes use act names recorded in the project's sample fixtures (see ADR 0013); no live data is shown on this screen.

## States

| State | What the user sees | Behaviour |
|---|---|---|
| Empty (first visit) | Form empty, "Rank these acts" is `aria-disabled` with the reason "Add a city, at least 3 crowd acts and at least 3 candidate acts to continue." | Focus starts at the top of the page (skip link first). No auto-focus on a field, so screen readers read the h1 first. |
| Sample rooms (M2-06) | Section "Try a sample room" between the lead and the form: one secondary-button link per pre-warmed room ("{venue}, {city}") and, under each, "Recorded real Qloo run, fetched {date}." | A link opens the stored slate at `/s/sample-{slug}` with zero Qloo calls and no budget spent. Plain anchors (no prefetch). Tab order: after the lead, before "Fill in the sample room". Hidden when the server has no sample rooms. |
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
| Demo limits note (M2-05) | A panel "Demo limits" in the aside under "What you get" (below the form at 768px and under): the per-visitor daily limit, that the sample rooms are always available, no login and no CAPTCHA | Always shown. In recorded-responses mode it says the limits are off in this demo and names the live limit |
| Offline | Notice: "You appear to be offline. Your entries stay on this page; reconnect to check matches." | Primary action keeps aria-disabled with this reason |
| Demo mode (recorded responses) | Chip at the right of the header row on every screen (drawn in every wireframe): "Demo mode: recorded Qloo responses" with info icon, plus the Demo-mode note under the lead | Shown whenever the server runs with recorded data. Names not in the recordings are reported on match confirmation with the dedicated message (not as an ordinary "no match") |
| Dark mode, 200% zoom, 320px | Same content, reflowed | See accessibility.md |

## Copy

Exact strings. Voice: plain, specific, no marketing. Wording rule: "audience-taste fit"; nothing that implies a prediction of sales or attendance.

| Element | String |
|---|---|
| Page title (`<title>`) | "Room setup: Headliner" (pattern "{page}: Headliner" on every screen) |
| Banner | "Audience-taste fit is aggregate affinity, not a ticket forecast. It compares the tastes of each act's audience with your regular crowd, using Qloo data. It says nothing about sales, attendance or any individual." (short form at 360px: first sentence + disclosure "What this means") |
| h1 | "Rank the acts you are considering by audience-taste fit" |
| Lead | "Headliner compares each act's audience with the artists your regulars already follow, using Qloo taste data, and shows the evidence behind every number." |
| Sample button | "Fill in the sample room" |
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
| Primary button | "Rank these acts" / loading "Ranking…" |
| Disabled reason | "Add a city, at least 3 crowd acts and at least 3 candidate acts to continue." (the sentence names only what is still missing, for example "Add 2 more candidate acts to continue.") |
| Privacy note | "Enter artist names and a city only. Do not enter personal details." |
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

- Tab order: skip link, product name link, Banner disclosure, sample button, city field, crowd add field, crowd Add button, each crowd chip's remove button, candidate add field, Add button, candidate chip removes, sentence disclosure (and its field and button when open), Rank these acts, footer links.
- Enter in an add field adds the act (it does not submit the form). Enter in the city field moves nothing. "Rank these acts" is the only submit.
- Landmarks: `header`, `main`, `footer`. Headings: h1 once; h2 for "Your room", "Acts you are considering", "How it works". The two act lists are `<ul>` with accessible names "Crowd acts" and "Candidate acts".
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
