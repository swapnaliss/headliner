# Screen: Match confirmation

Route (indicative): `/run/{runId}/confirm`, reached from [room setup](screen-room-setup.md); leads to the [slate](screen-slate.md). Built by M2-01. Uses [components](components.md): MatchPicker, ActChip, Button, TextField, EmptyState, ErrorState, Banner, ProgressStatus.

## Purpose

Make sure every typed name points at the right Qloo entity before anything is scored, because a wrong match poisons every number downstream. Ranking is blocked until every ambiguous or unmatched name is resolved. This is a domain invariant (an ambiguous match blocks ranking until confirmed).

**Owner decision 2026-10-27 (M2-01):** an exact top hit auto-resolves, as the ticket says. A name whose normalised text equals the top Qloo hit, with no other hit of that name, needs no confirmation and is listed under "Confirmed" without controls. Only ambiguous names, unmatched names and names with no recording ask the user. The earlier "Single matches to confirm" step, its bulk button and Change on every row are removed. Items not built in M2-01 are listed in "Deferred to M3-06" at the end.

The match-confidence rule, in one place:

| Qloo search result for the typed name | Row type | What the user must do |
|---|---|---|
| Top hit is the only hit named like the typed name (accents kept, case and spacing ignored) | **Exact**: listed under Confirmed, no controls | none |
| Any other non-empty result (several same-named hits, or the top hit is named differently, such as "Bjork" for "Björk") | **Needs your choice**: MatchPicker, nothing preselected | Pick one hit; "None of these" or "Remove act" leaves the act out |
| No hit | **No match**: reason and "Remove act" | Remove the act (or go back and respell it) |
| No recording (demo mode) | **Not in the recordings**: reason, "Use the sample room", "Remove act" | Use the sample room or remove the act |
| A hit picked from several | carries the caveat "Match chosen by you" onto the slate | "Change" reopens the choice |

"Bjork" typed, Qloo returns "Björk" first: the top hit is named differently, so it is a MatchPicker with both spellings visible. How hits are classified is `classifyMatch` in core; the screen does not guess confidence. Decided rows move to "Confirmed" (picked hit, with Change) or "Left out" (with "Put back").

Cases the screen must handle honestly:

- **Ambiguous name** (Phoenix, 5 hits): nothing preselected.
- **No match:** the user can try another spelling or remove the act.
- **Non-ASCII and accent differences:** "Bjork" to "Björk", "Sigur Ros" to "Sigur Rós". Typed and resolved names are both shown; the resolved name is used from then on.
- **Right-to-left or non-Latin names:** shown with `dir="auto"`, isolated from the surrounding sentence.
- **Demo mode with recorded responses only:** a name that is not in the recordings cannot be matched, and the screen says exactly that (distinct from "no match").

## Layout

Content hierarchy: (1) h1, (2) one status line, (3) the names that need a decision, (4) the confirmed names, (5) left-out names, (6) the rank button with its reason (in the summary card). Rows needing a decision come first across both lists, each labelled "Crowd act" or "Candidate act".

Landmarks: `header` (name, Demo chip, Banner), `main`, `footer`. Headings: h1 "Confirm the matches"; h2 "Needs your choice", "Confirmed (n)", "Left out (n)". The status line is a paragraph under the h1 with `role="status"`; it is not a heading.

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

12-column grid. Left (columns 1 to 8): decision rows, confirmed list, left-out list. Right (columns 9 to 12): a summary card with counts, "Rank these acts" with its reason, and "Back to edit the room". The summary card is sticky only when it is shorter than the viewport height and the viewport is at least 700px tall; otherwise it is static after the list. Hits in a MatchPicker use a two-column grid of radio rows from 4 hits up; reading order is row by row. At 1024px the card sits at the right in the same way but is not sticky. At 768px it moves below the list. At 1440px the content stays 1280px wide and centred; no new columns appear.

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
| Confirmed (4) ...                                      |                             |
+--------------------------------------------------------------------------------------+
```

## States

| State | What the user sees | Behaviour |
|---|---|---|
| Needs choice | MatchPicker per ambiguous name, nothing selected, "Remove act" beside it | "Rank these acts" `aria-disabled` with the reason naming pending names. Choosing a hit moves the row to Confirmed (choosing is the confirmation) and attaches "Match chosen by you" |
| All confirmed | Status "All {total} names confirmed." Rank button enabled and focused | Announced once |
| No match | EmptyState compact in the row, retry field, "Remove act" | Search again shows "Searching…" and announces the result |
| Name not in the recordings (demo mode) | Row title "{name} is not in the recorded responses" and the reason "This demo only has recorded responses and does not include {name}. Use the sample room or remove it." Buttons "Use the sample room" and "Remove act"; no retry field | Distinct from "No match": it explains that live search is off, instead of suggesting a spelling fix. Rank stays blocked until it is removed |
| Non-ASCII match | Row shows "{resolved} (you typed {typed})" | The resolved name is used from here on |
| Removing leaves too few | Reason becomes "Add another crowd act: only {n} remain." and the Back link is offered | Limits as in room setup |
| Blocked (attempt to rank early) | Activating the aria-disabled button moves focus to the first unresolved row and announces why | The button is never removed |
| Submitting | Button label "Ranking…" with `aria-busy="true"` and `aria-disabled="true"`; rows read-only | Navigates to the slate while the run is `scoring`; focus to the slate h1 |
| Back to the room | "Back to edit the room" returns to room setup with all typed entries and keeps confirmations for names whose text did not change; a changed or removed name loses its confirmation | Stated under the link: "Your confirmations are kept for names you do not change." |
| Expired or missing run | EmptyState "This run is no longer available." with "Start over" | |

## Copy

| Element | String |
|---|---|
| Page title | "Confirm the matches: Headliner" |
| Back link / note | "Back to edit the room" / "Your confirmations are kept for names you do not change." |
| h1 | "Confirm the matches" |
| Status line | "{a} names need your choice, {b} to confirm, {c} confirmed." (zero parts omitted) ; none pending: "All {total} names confirmed." |
| Jump button | "Go to the first one" |
| Loading status | "Matching names with Qloo: {done} of {total}." |
| Section headings | "Needs your choice" ; "Left out ({n})" ; "Confirmed ({n})" |
| Role labels | "Crowd act" ; "Candidate act" |
| Typed line | "You typed: {typed}" |
| Picker legend | "Which {typed}?" |
| Option metadata | "Artist" ; "Qloo popularity rank {value} of 100 (higher is better known on Qloo)" ; "No description from Qloo" |
| Last option | "None of these" |
| Selected marker | "Selected" |
| Confirmed row | "{resolved}" ; when different from typed: "{resolved} (you typed {typed})" ; status "Confirmed" ; only a hit the user picked has "Change" and the caveat "Match chosen by you" ; an exact match has no controls |
| Left out row | "{typed}" ; button "Put back" |
| Bulk | (removed) |
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
| Expired run | "This run is no longer available." / "Start over" |

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

## Deferred to M3-06

Not built in M2-01 (owner decision 2026-10-27); tracked on BL-01 with owner M3-06. These keep their specified behaviour until then.

- Inline "Try another spelling" field with "Search again" on a No-match row (today: "Remove act", or go back and respell in the room).
- Matching progress: skeleton rows and the "Matching names with Qloo: {done} of {total}." status (today the room form shows ranking progress while the whole run is one request).
- Per-row search error and whole-run matching failure states (today a failed live search is a "Could not search" row with "Remove act"; a total failure is the room form error).
- Budget-reached notice and offline notice.
- "Show {n} more" disclosure for more than 5 hits (the server returns at most 5).

Specified rows for these states:

| State | What the user sees |
|---|---|
| Loading (matching) | Skeleton rows per typed name; ProgressStatus "Matching names with Qloo: 4 of 9." with a `<progress>` | Polite live region, at most every 2 seconds and at completion: "Matching finished. 2 names need your choice, 3 to confirm." Rows replace skeletons in input order |
| Many hits | First 5 hits; a disclosure "Show {n} more" if Qloo returned more | One radio group |
| Search error (one name) | Inline ErrorState in the row "Could not search for {typed}. Try again." | Other rows unaffected |
| Matching failed (all) | ErrorState "Could not reach Qloo to check your names. Your entries are kept." with "Try again" and "Back to edit the room" | Focus to the heading |
| Budget reached | ErrorState "The demo has reached its live-data limit for now. Your entries are kept. Open the sample room, which uses recorded Qloo responses." with "Use the sample room" and "Back to edit the room" | No login, no CAPTCHA |
| Offline | Notice "You appear to be offline. Choices are kept on this page." | Rank button aria-disabled with the reason |
| Budget reached | "The demo has reached its live-data limit for now. Your entries are kept. Open the sample room, which uses recorded Qloo responses." |
| Offline | "You appear to be offline. Choices are kept on this page." |
