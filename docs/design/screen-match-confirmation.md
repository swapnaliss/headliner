# Screen: Match confirmation

Route (indicative): `/run/{runId}/confirm`, reached from [room setup](screen-room-setup.md); leads to the [slate](screen-slate.md). Built by M2-01. Uses [components](components.md): MatchPicker, ActChip, Button, TextField, EmptyState, ErrorState, Banner, ProgressStatus.

## Purpose

Make sure every typed name points at the right Qloo entity before anything is scored, because a wrong match poisons every number downstream. Ranking is blocked until every name is explicitly confirmed. This is a domain invariant (an ambiguous match blocks ranking until confirmed), and the design goes one step further: there is no silent auto-match. Even a name with a single Qloo hit is shown as a summary row that the user confirms.

The match-confidence rule, in one place:

| Qloo search result for the typed name | Row type | What the user must do |
|---|---|---|
| Exactly one hit | **Single match**: summary row "{resolved} (you typed {typed})" | Confirm it (per row, or "Confirm all {n} single matches"), or change it, or remove it |
| More than one hit | **Needs your choice**: MatchPicker, nothing preselected | Pick one hit, or "None of these" |
| No hit, or "None of these" chosen | **No match** | Try another spelling, or remove the act |
| Hit chosen from several, or a name that differs from what was typed | carries the caveat "Match chosen by you" onto the slate | none |

"Bjork" typed, Qloo returns the single entity "Björk": it is a single match shown for confirmation, with both spellings visible. "Phoenix" with 5 hits is a MatchPicker with 5 options and "None of these". How hits are counted comes from the Qloo search result (data source below); the screen does not guess confidence.

Cases the screen must handle honestly:

- **Ambiguous name** (Phoenix, 5 hits): nothing preselected.
- **No match:** the user can try another spelling or remove the act.
- **Non-ASCII and accent differences:** "Bjork" to "Björk", "Sigur Ros" to "Sigur Rós". Typed and resolved names are both shown; the resolved name is used from then on.
- **Right-to-left or non-Latin names:** shown with `dir="auto"`, isolated from the surrounding sentence.
- **Demo mode with recorded responses only:** a name that is not in the recordings cannot be matched, and the screen says exactly that (distinct from "no match").

## Layout

Content hierarchy: (1) h1, (2) one status line, (3) the names that need a decision, (4) the single matches to confirm, (5) the confirmed names, (6) the rank button with its reason. Rows needing a decision come first across both lists, each labelled "Crowd act" or "Candidate act".

Landmarks: `header` (name, Demo chip, Banner), `main`, `footer`. Headings: h1 "Confirm the matches"; h2 "Needs your choice", "Single matches to confirm", "Confirmed". The status line is a paragraph under the h1 with `role="status"`; it is not a heading.

### Mobile 360px

```
+--------------------------------------+
| Headliner        [Demo mode chip]    |
| (i) Audience-taste fit is aggregate  |
|     affinity, not a ticket forecast. |
+--------------------------------------+
| < Back to edit the room              |
| Confirm the matches                  |  h1
| 2 names need your choice, 3 to       |  status (live)
| confirm, 4 confirmed.                |
| [ Go to the first one ]              |
+--------------------------------------+
| Needs your choice                    |  h2
| +----------------------------------+ |
| | Candidate act                    | |
| | You typed: Phoenix               | |
| | Which Phoenix?                   | |  fieldset legend
| | ( ) Phoenix                      | |  radio rows, 44px+
| |     Artist                       | |
| |     Qloo popularity rank 83.1 of | |
| |     100 (higher = better known) | |
| |     No description from Qloo     | |
| | ( ) Phoenix ... 3 more hits ...  | |
| | ( ) None of these                | |
| | [ Remove act ]                   | |
| +----------------------------------+ |
| | Crowd act                        | |
| | You typed: Xyzzyq                | |
| | No Qloo match for Xyzzyq         | |
| | [ Try another spelling ]         | |
| | [ Search again ] [ Remove act ]  | |
| +----------------------------------+ |
+--------------------------------------+
| Single matches to confirm (3)        |  h2
| [ Confirm all 3 single matches ]     |
| Björk (you typed Bjork)              |
|   [ Confirm ] [ Change ] [ Remove ]  |
| Sigur Rós (you typed Sigur Ros)      |
|   [ Confirm ] [ Change ] [ Remove ]  |
+--------------------------------------+
| Confirmed (4)                        |  h2
| Apparat   (v) Confirmed  [Change]    |
+--------------------------------------+
| [ Rank these acts ]  (aria-disabled) |
| 5 names still need your decision:    |
| Phoenix, Xyzzyq, Björk and 2 more.   |
+--------------------------------------+
```

Hit values in the wireframe are layout placeholders; real values come from the Qloo search results.

### Desktop 1280px

12-column grid. Left (columns 1 to 8): decision rows, single matches, confirmed list. Right (columns 9 to 12): a summary card with counts, "Rank these acts" with its reason, and "Back to edit the room". The summary card is sticky only when it is shorter than the viewport height and the viewport is at least 700px tall; otherwise it is static after the list. Hits in a MatchPicker use a two-column grid of radio rows from 4 hits up; reading order is row by row. At 1024px the card sits at the right in the same way but is not sticky. At 768px it moves below the list. At 1440px the content stays 1280px wide and centred; no new columns appear.

```
+--------------------------------------------------------------------------------------+
| Headliner                                                    [Demo mode chip]        |
| (i) Audience-taste fit is aggregate affinity, not a ticket forecast. ...             |
+--------------------------------------------------------------------------------------+
| Confirm the matches                                    | Summary                     |
| 2 names need your choice, 3 to confirm, 4 confirmed.   | 2 need a choice             |
| Needs your choice                                      | 3 to confirm                |
|  Candidate act - You typed: Phoenix                    | 4 confirmed                 |
|   ( ) Phoenix  Artist  ...         ( ) Phoenix  Artist | [ Rank these acts ]         |
|   ( ) ...                          ( ) None of these   | 5 names still need ...      |
|   [ Remove act ]                                       | < Back to edit the room     |
|  Crowd act - You typed: Xyzzyq - No Qloo match         |                             |
| Single matches to confirm (3) [ Confirm all 3 ... ]    |                             |
| Confirmed (4) ...                                      |                             |
+--------------------------------------------------------------------------------------+
```

## States

| State | What the user sees | Behaviour |
|---|---|---|
| Loading (matching) | Skeleton rows per typed name; ProgressStatus "Matching names with Qloo: 4 of 9." with a `<progress>` | Polite live region, at most every 2 seconds and at completion: "Matching finished. 2 names need your choice, 3 to confirm." Rows replace skeletons in input order |
| Needs choice | MatchPicker per ambiguous name, nothing selected, "Remove act" beside it | "Rank these acts" `aria-disabled` with the reason naming pending names. Choosing a hit moves the row to Confirmed (choosing is the confirmation) and attaches "Match chosen by you" |
| Single matches | Summary rows with Confirm, Change, Remove, and the bulk button "Confirm all {n} single matches" | Confirm moves the row to Confirmed and announces "{resolved} confirmed. {k} left." The bulk button announces "{n} single matches confirmed." |
| All confirmed | Status "All {total} names confirmed." Rank button enabled and focused | Announced once |
| Many hits | First 5 hits; a disclosure "Show {n} more" if Qloo returned more | One radio group |
| No match | EmptyState compact in the row, retry field, "Remove act" | Search again shows "Searching…" and announces the result |
| Name not in the recordings (demo mode) | Row title "{name} is not in the recorded responses" and the reason "This demo only has recorded responses and does not include {name}. Use the sample room or remove it." Buttons "Use the sample room" and "Remove act"; no retry field | Distinct from "No match": it explains that live search is off, instead of suggesting a spelling fix. Rank stays blocked until it is removed |
| Non-ASCII match | Row shows "{resolved} (you typed {typed})" | The resolved name is used from here on |
| Removing leaves too few | Reason becomes "Add another crowd act: only {n} remain." and the Back link is offered | Limits as in room setup |
| Search error (one name) | Inline ErrorState in the row "Could not search for {typed}. Try again." | Other rows unaffected |
| Matching failed (all) | ErrorState "Could not reach Qloo to check your names. Your entries are kept." with "Try again" and "Back to edit the room" | Focus to the heading |
| Budget reached | ErrorState "The demo has reached its live-data limit for now. Your entries are kept. Open the sample room, which uses recorded Qloo responses." with "Use the sample room" and "Back to edit the room" | No login, no CAPTCHA |
| Blocked (attempt to rank early) | Activating the aria-disabled button moves focus to the first unresolved row and announces why | The button is never removed |
| Submitting | Button label "Ranking…" with `aria-busy="true"` and `aria-disabled="true"`; rows read-only | Navigates to the slate while the run is `scoring`; focus to the slate h1 |
| Back to the room | "Back to edit the room" returns to room setup with all typed entries and keeps confirmations for names whose text did not change; a changed or removed name loses its confirmation | Stated under the link: "Your confirmations are kept for names you do not change." |
| Expired or missing run | EmptyState "This run is no longer available." with "Start over" | |
| Offline | Notice "You appear to be offline. Choices are kept on this page." | Rank button aria-disabled with the reason |

## Copy

| Element | String |
|---|---|
| Page title | "Confirm the matches: Headliner" |
| Back link / note | "Back to edit the room" / "Your confirmations are kept for names you do not change." |
| h1 | "Confirm the matches" |
| Status line | "{a} names need your choice, {b} to confirm, {c} confirmed." (zero parts omitted) ; none pending: "All {total} names confirmed." |
| Jump button | "Go to the first one" |
| Loading status | "Matching names with Qloo: {done} of {total}." |
| Section headings | "Needs your choice" ; "Single matches to confirm ({n})" ; "Confirmed ({n})" |
| Role labels | "Crowd act" ; "Candidate act" |
| Typed line | "You typed: {typed}" |
| Picker legend | "Which {typed}?" |
| Option metadata | "Artist" ; "Qloo popularity rank {value} of 100 (higher is better known on Qloo)" ; "No description from Qloo" |
| Last option | "None of these" |
| Selected marker | "Selected" |
| Single match row | "{resolved}" ; when different from typed: "{resolved} (you typed {typed})" ; buttons "Confirm" (accessible "Confirm match for {resolved}") ; "Change" ; "Remove" |
| Bulk | "Confirm all {n} single matches" |
| Confirmed row | "{resolved}" ; status "Confirmed" ; button "Change" (accessible "Change match for {resolved}") |
| Chosen-by-you caveat | "Match chosen by you" |
| No-match title / reason | "No Qloo match for {typed}" / "Qloo returned no artist with this name. Check the spelling or try the name the artist uses most." |
| Retry | label "Try another spelling" ; "Search again" ; loading "Searching…" |
| Not in recordings | "{name} is not in the recorded responses" / "This demo only has recorded responses and does not include {name}. Use the sample room or remove it." ; "Use the sample room" |
| Remove | "Remove act" ; announcement "{typed} removed. {n} {role} acts left." |
| Picker error | "Choose one match for {typed}, or remove it." |
| Rank button | "Rank these acts" ; loading "Ranking…" |
| Blocked reason (names) | "{n} names still need your decision: {list}." (list cut after 3 names with "and {k} more") |
| Blocked reason (counts) | "Add another crowd act: only {n} remain." ; "Add another candidate act: only {n} remain." |
| Ready note | "Everything is confirmed. Ranking uses the Qloo entities shown above." |
| Search failure (row) | "Could not search for {typed}. Try again." |
| Total failure | "Could not reach Qloo to check your names. Your entries are kept." |
| Budget reached | "The demo has reached its live-data limit for now. Your entries are kept. Open the sample room, which uses recorded Qloo responses." |
| Expired run | "This run is no longer available." / "Start over" |
| Offline | "You appear to be offline. Choices are kept on this page." |

Names in every string are untrusted plain text: inserted as text nodes, wrapped in `<bdi>`, never parsed. Where a name sits inside an attribute string (`aria-label`, announcement text for a live region), it is wrapped in Unicode isolates (U+2068 before, U+2069 after) because `<bdi>` cannot be used there.

## Keyboard and a11y

- Tab order: skip link, back link, "Go to the first one", unresolved rows in document order (each picker: radios, then Remove), single-match rows (Confirm, Change, Remove) and the bulk button, confirmed rows (Change), the summary card (desktop) or rank button (mobile), footer.
- Inside a MatchPicker, Tab enters the group once; Arrow keys move; Space selects. No preselected option for ambiguous names.
- "Go to the first one" and the blocked rank button move focus to the first unresolved fieldset legend or row heading (`tabindex="-1"`) and announce why.
- Rank button: `aria-disabled="true"` with `aria-describedby` to the reason paragraph. While submitting it also sets `aria-busy="true"` and ignores repeat activation; native `disabled` is not used, so focus is never lost.
- The h1 is the only heading for the page title; the status line is a polite `role="status"` paragraph updated on count changes, not on every row.
- Selected state: 1px border plus an inset 1px ring (no layout shift, so the row does not jump), a check icon, the word "Selected" and the `checked` state. Colour is not the only cue. Contrast pairs are in design-system.md.
- Untrusted names: plain text, `dir="auto"`, wrapped fully on this screen (correctness depends on reading the whole name); descriptors from Qloo are plain text too. The entity id never appears in a link built from a name.
- 44px targets for radio rows, buttons and "Confirm"/"Change"/"Remove"; 8px between targets.

## Data source

Logical field names; the zod schema from M1-02 and M2-01 is the source of truth.

| Element | Source |
|---|---|
| Row list and role label | `run.matches[]` with `role` (`crowd` or `candidate`) |
| Typed name | `run.matches[].typedName` (plain text) |
| Row type | `run.matches[].status` (`single`, `ambiguous`, `none`, `not-in-recordings`) set by the match step from the number of Qloo search hits; `confirmed: boolean` is set only by an explicit user action |
| Hits in a MatchPicker | `run.matches[].hits[]` with `entityId`, `name`, `type`, optional `descriptor`, optional `popularity` (shown as "Qloo popularity rank", popularity x 100, one decimal, "of 100") |
| Resolved name and entity id after confirmation | `Act.name`, `Act.qlooEntityId` (`matchConfidence` records `single-confirmed` or `chosen-by-user`) |
| "Match chosen by you" caveat | set when the user picks among several hits; carried into `ActResult.caveats[]` with code `low-match-confidence` |
| Progress counts | `run.progress { done, total }` while `run.state = matching` |
| Ranking allowed | true only when every `run.matches[]` is `confirmed` and list sizes meet the limits; `run.state` moves from `awaiting_confirmation` to `scoring` when "Rank these acts" succeeds |
| Demo and budget states | server flags: recorded-response mode, and the per-IP or global budget status |
| Banner, Demo chip | static copy; server config flag |
