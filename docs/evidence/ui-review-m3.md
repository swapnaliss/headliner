# UI review, M3-06 (accessibility, states and mobile)

Date: 2026-10-28. Build: `feat/m3-06-ui-states-a11y-mobile-27-10-2026`, `DEMO_MODE=fixtures`, no keys, no database, no model.

## ui-reviewer

Round 1 verdict: **PASS**, no blocking issue (1 of the allowed 3 rounds used).

Inputs given to the reviewer: ticket id, the screen specs in `docs/design/`, the screenshot directory `.review/M3-06/` (local, gitignored) and the axe JSON. 168 captures: 28 scenes at 375, 768 and 1440 px, light and dark, covering room setup (empty, sample filled, validation error, ranking in progress, 503 error, daily demo limit, one-sentence intake open, reading, success, partial, question, failed), match confirmation (not in the recordings, picker, gone), slate (ranked, with notes, 404), act detail (ranked with cities, cities loading, cities error, no data, evidence open, 404), shared slate and act, shared and global 404.

Honest limit: the reviewer read a sample of the captures (room-empty 375 light and 1440 dark, demo-limit 375 light, slate-ranked 1440 light, act-cities-error 375 dark, act-evidence-open 768 light, global-404 375 dark), not all 168, and did not open the axe JSON.

Polish items from the reviewer (none blocking):

1. Share field shows a localhost origin in the capture: a capture artefact; the wrapping is kept on purpose.
2. Act detail at 375 px is about 7,000 px tall because all 12 Evidence rows are listed. Optional collapse; not in the spec. Logged to BL-01.
3. The disabled "Rank these acts" button is grey and its reason sits a gap below it. Reads as unavailable; axe reports no contrast issue; the pair is in `docs/evidence/contrast.md`. Logged to BL-01.

## axe

`.review/M3-06/axe-results.json`: 168 page states (28 scenes x 3 widths x 2 schemes), rules WCAG 2.0, 2.1, 2.2 A and AA plus best practices: **0 serious or critical, 0 moderate or minor**. The gate suite `apps/web/tests/a11y/sweep.spec.ts` runs the same scenes at 360 and 1280 px, light and dark (112 tests), and asserts the Banner, one `main`, `header`, `footer` and `h1`, a title containing "Headliner", `lang="en"`, and no horizontal scroll at 360 px.

## Keyboard

`apps/web/tests/keyboard/journey.spec.ts`: skip link, setup, confirm (blocked press explains, radio chosen with Space), slate, copy share link with Enter, open an act, Evidence link, open the disclosure, Escape closes it and focus returns to its summary, all at 360 px with no pointer events. Also: Tab reaches the footer without a trap, Shift+Tab moves backwards, and every Tab stop shows a focus outline of at least 2 px.

## Not done / limits

- One screen reader pass on the slate flow was not performed in this environment (no screen reader available to the worker); the owner should do it before M4. axe and the keyboard tests are automated checks only.
- Zoom to 200% and text-spacing overrides were not run as automated checks; only "no horizontal scroll at 360 px" is asserted. 320 px was not tested.
- Matching progress, "Try another spelling" and per-row retry on the confirm screen are not built; reasons are in `docs/design/screen-match-confirmation.md`.
