# Design system

Tokens and rules every Headliner screen is built from. Components are in [components.md](components.md), accessibility checks in [accessibility.md](accessibility.md). Contrast ratios in this file are computed by `scripts/check-contrast.mjs`, not by hand.

## Direction in one paragraph

Headliner is an editorial booking desk: a serious, confident tool for a venue's talent buyer, closer to a printed running order than to a dashboard. The page is warm paper (a near-black, slightly cool page in dark mode) with ink-coloured text and exactly one strong accent, a saturated indigo, used for the wordmark mark, the primary button, links, rank numerals and the selected state, and for nothing else. Hierarchy comes from type and whitespace, not from boxes: h1, h2, the wordmark and the rank numerals are set in one serif display face, everything the user reads as data (body, forms, tables, chips, numbers, every entity name) stays on the system sans stack. Surfaces are flat and hairline-bordered, with at most a very faint shadow on the sticky action bar. Status colours (caution, error, ok, info, neutral) are kept apart from the accent and always travel with an icon and a word. Numbers are tabular so Fit and rank line up, and Fit stays a printed number (section 8). There is no hero image, no gradient, no emoji, no stock imagery and no decorative chart: every mark on screen is either text, a control, or a value with evidence behind it. Light and dark are designed together and both must look finished.

## 1. Colour tokens

All tokens are semantic (`--text`, `--surface`), never named after a hue. Light and dark values live in one place (section 9) using `light-dark()`. Dark mode follows `prefers-color-scheme`; a `data-theme="light|dark"` attribute on `<html>` overrides it.

Rules:

- Body text and any text in a component: 4.5:1 minimum. Large text, icons that carry meaning, input borders, focus ring, bar fills: 3:1 minimum. Every pairing used by a component is in the tables below; adding a new pairing means adding a row and running the script.
- One accent. `--accent` (indigo) is the only brand colour. `--link` is the same colour on purpose: links, the wordmark mark, primary fills, rank numerals and the selected state are all the accent, so "this is interactive or chosen" has one meaning. No status pair uses a violet or indigo hue, so the accent can never be read as a status.
- Status is never colour alone. Every status has an icon (shape differs per status) and a text label (see section 7). The colours below only reinforce.
- Standing ("Qloo popularity rank") uses the neutral status colours only. Above, similar and below are not good or bad, and the glyphs are not arrows, because arrows read as a trend and the trending data in this environment is flat.
- Disabled controls are exempt from WCAG contrast, but this project does not use the exemption for the primary button: its text (`--text-muted`) and its solid border (`--border-control`) on `--sunken` are in the contrast tables and meet AA (4.5:1 text, 3:1 border). The reason for a disabled action is always written next to it (see components.md, Button).
- Skeleton fills and decorative hairlines (`--border-subtle`) carry no information and are exempt; they are never the only cue for anything.

### Token reference

| Token | Light | Dark | Use |
|---|---|---|---|
| `--canvas` | `#F7F5F0` | `#111013` | page background |
| `--surface` | `#FFFFFF` | `#1A191D` | cards, inputs, popovers |
| `--sunken` | `#EEEBE3` | `#0B0B0D` | code and evidence blocks, table stripes |
| `--text` | `#14130F` | `#EDEBE6` | body and headings |
| `--text-muted` | `#55524D` | `#ABA8B2` | captions, helper text, placeholder |
| `--link` | `#4A35C8` | `#B3A6FF` | inline links (also underlined); same value as `--accent` by design |
| `--accent` | `#4A35C8` | `#B3A6FF` | wordmark mark, primary button fill, links, tertiary buttons, rank numerals, selected border, bar fill |
| `--accent-hover` | `#3826A6` | `#CCC3FF` | primary button hover, link hover |
| `--on-accent` | `#FFFFFF` | `#17113F` | text on primary button |
| `--accent-tint` | `#ECE9FB` | `#25204A` | selected row background, feature-card hover wash |
| `--focus` | `#0A5FD0` | `#8DBDF5` | focus ring |
| `--border-control` | `#6B675F` | `#8B8795` | input, checkbox, radio, chip borders |
| `--border-subtle` | `#D9D5CA` | `#302E35` | decorative dividers only |
| `--track` | `#DDD9CF` | `#3B3943` | bar track |
| `--banner-bg` / `--banner-fg` / `--banner-border` | `#FFF4D6` / `#3A2D00` / `#7A5A00` | `#3A2F10` / `#FBE9B5` / `#C9A23A` | Banner |
| `--ok-bg` / `--ok-fg` | `#E3F3E7` / `#14532D` | `#15301C` / `#A5E0B2` | success status |
| `--caution-bg` / `--caution-fg` | `#FFF0CF` / `#6B4200` | `#3A2A0A` / `#F3C873` | caveat, thin data |
| `--error-bg` / `--error-fg` | `#FBE5E2` / `#8F1D1D` | `#401614` / `#FFB3AC` | error |
| `--info-bg` / `--info-fg` | `#E2EEFA` / `#0B4F8A` | `#122A40` / `#A3CFF7` | neutral information, progress |
| `--neutral-bg` / `--neutral-fg` | `#EAE8E1` / `#45423D` | `#2C2A27` / `#D2CEC5` | unavailable, standing, chips |

### Contrast, light

Table format read by `scripts/check-contrast.mjs`: columns `Pair`, `Foreground`, `Background`, `Required` (4.5 or 3), `Ratio` (rounded down to 2 dp, written by `node scripts/check-contrast.mjs docs/design/design-system.md --update`). The script prints `PASS|FAIL name fg bg ratio required` per row and exits non-zero on any FAIL or on a stale Ratio.

| Pair | Foreground | Background | Required | Ratio |
|---|---|---|---|---|
| light: text on canvas | `#14130F` | `#F7F5F0` | 4.5 | 17.05 |
| light: text on surface | `#14130F` | `#FFFFFF` | 4.5 | 18.58 |
| light: text on sunken | `#14130F` | `#EEEBE3` | 4.5 | 15.60 |
| light: text-muted on canvas | `#55524D` | `#F7F5F0` | 4.5 | 7.13 |
| light: text-muted on surface | `#55524D` | `#FFFFFF` | 4.5 | 7.77 |
| light: text-muted on sunken | `#55524D` | `#EEEBE3` | 4.5 | 6.52 |
| light: placeholder (text-muted) on surface | `#55524D` | `#FFFFFF` | 4.5 | 7.77 |
| light: disabled primary button text (text-muted) on sunken | `#55524D` | `#EEEBE3` | 4.5 | 6.52 |
| light: disabled primary button border (border-control) on sunken | `#6B675F` | `#EEEBE3` | 3 | 4.72 |
| light: link on canvas | `#4A35C8` | `#F7F5F0` | 4.5 | 7.31 |
| light: link on surface | `#4A35C8` | `#FFFFFF` | 4.5 | 7.97 |
| light: link on banner | `#4A35C8` | `#FFF4D6` | 4.5 | 7.27 |
| light: primary button text on accent | `#FFFFFF` | `#4A35C8` | 4.5 | 7.97 |
| light: primary button text on accent-hover | `#FFFFFF` | `#3826A6` | 4.5 | 10.52 |
| light: secondary button text on surface | `#4A35C8` | `#FFFFFF` | 4.5 | 7.97 |
| light: secondary button border on surface | `#4A35C8` | `#FFFFFF` | 3 | 7.97 |
| light: text on selected row (accent-tint) | `#14130F` | `#ECE9FB` | 4.5 | 15.59 |
| light: selected row border (accent) on surface | `#4A35C8` | `#FFFFFF` | 3 | 7.97 |
| light: input border on surface | `#6B675F` | `#FFFFFF` | 3 | 5.62 |
| light: input border on canvas | `#6B675F` | `#F7F5F0` | 3 | 5.16 |
| light: focus ring on canvas | `#0A5FD0` | `#F7F5F0` | 3 | 5.41 |
| light: focus ring on surface | `#0A5FD0` | `#FFFFFF` | 3 | 5.89 |
| light: focus ring on sunken | `#0A5FD0` | `#EEEBE3` | 3 | 4.95 |
| light: focus ring on banner | `#0A5FD0` | `#FFF4D6` | 3 | 5.38 |
| light: focus ring on accent-tint | `#0A5FD0` | `#ECE9FB` | 3 | 4.94 |
| light: banner text | `#3A2D00` | `#FFF4D6` | 4.5 | 12.32 |
| light: banner border on canvas | `#7A5A00` | `#F7F5F0` | 3 | 5.85 |
| light: ok status text and icon | `#14532D` | `#E3F3E7` | 4.5 | 7.91 |
| light: ok status border on surface | `#14532D` | `#FFFFFF` | 3 | 9.11 |
| light: caution (caveat, thin data) text and icon | `#6B4200` | `#FFF0CF` | 4.5 | 7.74 |
| light: caution border on surface | `#6B4200` | `#FFFFFF` | 3 | 8.73 |
| light: error status text and icon | `#8F1D1D` | `#FBE5E2` | 4.5 | 7.37 |
| light: error border on surface | `#8F1D1D` | `#FFFFFF` | 3 | 8.89 |
| light: error text on surface (field message) | `#8F1D1D` | `#FFFFFF` | 4.5 | 8.89 |
| light: info status text and icon | `#0B4F8A` | `#E2EEFA` | 4.5 | 7.13 |
| light: info border on surface | `#0B4F8A` | `#FFFFFF` | 3 | 8.40 |
| light: neutral (unavailable, standing) text and icon | `#45423D` | `#EAE8E1` | 4.5 | 8.15 |
| light: neutral border on surface | `#45423D` | `#FFFFFF` | 3 | 10.00 |
| light: chip border on surface | `#6B675F` | `#FFFFFF` | 3 | 5.62 |
| light: chip text on neutral-bg | `#45423D` | `#EAE8E1` | 4.5 | 8.15 |
| light: strength bar fill on track | `#4A35C8` | `#DDD9CF` | 3 | 5.65 |
| light: strength bar fill on surface | `#4A35C8` | `#FFFFFF` | 3 | 7.97 |
| light: thin-data bar fill (hatched) on track | `#6B4200` | `#DDD9CF` | 3 | 6.19 |
| light: link on sunken | `#4A35C8` | `#EEEBE3` | 4.5 | 6.69 |
| light: text-muted on accent-tint | `#55524D` | `#ECE9FB` | 4.5 | 6.52 |
| light: focus ring on error-bg | `#0A5FD0` | `#FBE5E2` | 3 | 4.88 |
| light: focus ring on neutral-bg | `#0A5FD0` | `#EAE8E1` | 3 | 4.81 |
| light: focus ring on caution-bg | `#0A5FD0` | `#FFF0CF` | 3 | 5.22 |
| light: focus ring on info-bg | `#0A5FD0` | `#E2EEFA` | 3 | 5.01 |
| light: focus ring on ok-bg | `#0A5FD0` | `#E3F3E7` | 3 | 5.12 |
| light: bar value text on surface | `#14130F` | `#FFFFFF` | 4.5 | 18.58 |
| light: progress fill (info) on track | `#0B4F8A` | `#DDD9CF` | 3 | 5.96 |
| light: accent (links, tertiary button) on canvas | `#4A35C8` | `#F7F5F0` | 4.5 | 7.31 |
| light: accent (links, tertiary button) on surface | `#4A35C8` | `#FFFFFF` | 4.5 | 7.97 |
| light: accent (links) on sunken | `#4A35C8` | `#EEEBE3` | 4.5 | 6.69 |
| light: accent (links) on accent-tint | `#4A35C8` | `#ECE9FB` | 4.5 | 6.68 |
| light: accent-hover (link hover) on canvas | `#3826A6` | `#F7F5F0` | 4.5 | 9.65 |
| light: accent-hover (link hover) on surface | `#3826A6` | `#FFFFFF` | 4.5 | 10.52 |
| light: wordmark mark fill (accent) on canvas | `#4A35C8` | `#F7F5F0` | 3 | 7.31 |
| light: rank numeral, large text (accent) on surface | `#4A35C8` | `#FFFFFF` | 3 | 7.97 |
| light: rank numeral, large text (accent) on canvas | `#4A35C8` | `#F7F5F0` | 3 | 7.31 |

### Contrast, dark

| Pair | Foreground | Background | Required | Ratio |
|---|---|---|---|---|
| dark: text on canvas | `#EDEBE6` | `#111013` | 4.5 | 15.91 |
| dark: text on surface | `#EDEBE6` | `#1A191D` | 4.5 | 14.68 |
| dark: text on sunken | `#EDEBE6` | `#0B0B0D` | 4.5 | 16.50 |
| dark: text-muted on canvas | `#ABA8B2` | `#111013` | 4.5 | 8.10 |
| dark: text-muted on surface | `#ABA8B2` | `#1A191D` | 4.5 | 7.47 |
| dark: text-muted on sunken | `#ABA8B2` | `#0B0B0D` | 4.5 | 8.40 |
| dark: placeholder (text-muted) on surface | `#ABA8B2` | `#1A191D` | 4.5 | 7.47 |
| dark: disabled primary button text (text-muted) on sunken | `#ABA8B2` | `#0B0B0D` | 4.5 | 8.40 |
| dark: disabled primary button border (border-control) on sunken | `#8B8795` | `#0B0B0D` | 3 | 5.61 |
| dark: link on canvas | `#B3A6FF` | `#111013` | 4.5 | 8.86 |
| dark: link on surface | `#B3A6FF` | `#1A191D` | 4.5 | 8.17 |
| dark: link on banner | `#B3A6FF` | `#3A2F10` | 4.5 | 6.15 |
| dark: primary button text on accent | `#17113F` | `#B3A6FF` | 4.5 | 8.25 |
| dark: primary button text on accent-hover | `#17113F` | `#CCC3FF` | 4.5 | 10.78 |
| dark: secondary button text on surface | `#B3A6FF` | `#1A191D` | 4.5 | 8.17 |
| dark: secondary button border on surface | `#B3A6FF` | `#1A191D` | 3 | 8.17 |
| dark: text on selected row (accent-tint) | `#EDEBE6` | `#25204A` | 4.5 | 12.73 |
| dark: selected row border (accent) on surface | `#B3A6FF` | `#1A191D` | 3 | 8.17 |
| dark: input border on surface | `#8B8795` | `#1A191D` | 3 | 4.99 |
| dark: input border on canvas | `#8B8795` | `#111013` | 3 | 5.41 |
| dark: focus ring on canvas | `#8DBDF5` | `#111013` | 3 | 9.68 |
| dark: focus ring on surface | `#8DBDF5` | `#1A191D` | 3 | 8.93 |
| dark: focus ring on sunken | `#8DBDF5` | `#0B0B0D` | 3 | 10.04 |
| dark: focus ring on banner | `#8DBDF5` | `#3A2F10` | 3 | 6.73 |
| dark: focus ring on accent-tint | `#8DBDF5` | `#25204A` | 3 | 7.75 |
| dark: banner text | `#FBE9B5` | `#3A2F10` | 4.5 | 10.93 |
| dark: banner border on canvas | `#C9A23A` | `#111013` | 3 | 7.86 |
| dark: ok status text and icon | `#A5E0B2` | `#15301C` | 4.5 | 9.44 |
| dark: ok status border on surface | `#A5E0B2` | `#1A191D` | 3 | 11.58 |
| dark: caution (caveat, thin data) text and icon | `#F3C873` | `#3A2A0A` | 4.5 | 8.78 |
| dark: caution border on surface | `#F3C873` | `#1A191D` | 3 | 11.09 |
| dark: error status text and icon | `#FFB3AC` | `#401614` | 4.5 | 9.15 |
| dark: error border on surface | `#FFB3AC` | `#1A191D` | 3 | 10.24 |
| dark: error text on surface (field message) | `#FFB3AC` | `#1A191D` | 4.5 | 10.24 |
| dark: info status text and icon | `#A3CFF7` | `#122A40` | 4.5 | 8.96 |
| dark: info border on surface | `#A3CFF7` | `#1A191D` | 3 | 10.68 |
| dark: neutral (unavailable, standing) text and icon | `#D2CEC5` | `#2C2A27` | 4.5 | 9.11 |
| dark: neutral border on surface | `#D2CEC5` | `#1A191D` | 3 | 11.13 |
| dark: chip border on surface | `#8B8795` | `#1A191D` | 3 | 4.99 |
| dark: chip text on neutral-bg | `#D2CEC5` | `#2C2A27` | 4.5 | 9.11 |
| dark: strength bar fill on track | `#B3A6FF` | `#3B3943` | 3 | 5.29 |
| dark: strength bar fill on surface | `#B3A6FF` | `#1A191D` | 3 | 8.17 |
| dark: thin-data bar fill (hatched) on track | `#F3C873` | `#3B3943` | 3 | 7.19 |
| dark: link on sunken | `#B3A6FF` | `#0B0B0D` | 4.5 | 9.19 |
| dark: text-muted on accent-tint | `#ABA8B2` | `#25204A` | 4.5 | 6.48 |
| dark: focus ring on error-bg | `#8DBDF5` | `#401614` | 3 | 7.99 |
| dark: focus ring on neutral-bg | `#8DBDF5` | `#2C2A27` | 3 | 7.31 |
| dark: focus ring on caution-bg | `#8DBDF5` | `#3A2A0A` | 3 | 7.08 |
| dark: focus ring on info-bg | `#8DBDF5` | `#122A40` | 3 | 7.49 |
| dark: focus ring on ok-bg | `#8DBDF5` | `#15301C` | 3 | 7.29 |
| dark: bar value text on surface | `#EDEBE6` | `#1A191D` | 4.5 | 14.68 |
| dark: progress fill (info) on track | `#A3CFF7` | `#3B3943` | 3 | 6.92 |
| dark: accent (links, tertiary button) on canvas | `#B3A6FF` | `#111013` | 4.5 | 8.86 |
| dark: accent (links, tertiary button) on surface | `#B3A6FF` | `#1A191D` | 4.5 | 8.17 |
| dark: accent (links) on sunken | `#B3A6FF` | `#0B0B0D` | 4.5 | 9.19 |
| dark: accent (links) on accent-tint | `#B3A6FF` | `#25204A` | 4.5 | 7.09 |
| dark: accent-hover (link hover) on canvas | `#CCC3FF` | `#111013` | 4.5 | 11.57 |
| dark: accent-hover (link hover) on surface | `#CCC3FF` | `#1A191D` | 4.5 | 10.67 |
| dark: wordmark mark fill (accent) on canvas | `#B3A6FF` | `#111013` | 3 | 8.86 |
| dark: rank numeral, large text (accent) on surface | `#B3A6FF` | `#1A191D` | 3 | 8.17 |
| dark: rank numeral, large text (accent) on canvas | `#B3A6FF` | `#111013` | 3 | 8.86 |

Re-run after any token change: `node scripts/check-contrast.mjs docs/design/design-system.md`. M3-06 re-runs it as part of the audit.

## 2. Typography

Two voices, one narrow exception.

**Rule.** All running text and all data use the system font stack: no network cost, and the operating system supplies Latin, Cyrillic, Greek, CJK, Arabic, Hebrew and Devanagari glyphs for entity names. Layout never assumes a Latin width. The single exception is one self-hosted display face, used only for `h1`, `h2`, the header wordmark and the rank numerals on cards. Nothing else uses it: not body, not form fields, not tables, not chips, not Fit or any other number, and never an entity name.

**Why the exception is safe.** Headings, the wordmark and rank digits are our own copy, so the face only needs Latin letters and digits and we choose exactly what it must cover. Entity names (acts, tags, cities, anything from Qloo, the user or the model) are third-party text in any script and stay on `--font-sans`. Where a heading contains an entity (h1 "Slate for {city}"), the entity is wrapped in `<bdi class="entity">`, which resets `font-family` to `--font-sans`, so a CJK, Arabic or Devanagari city is never drawn in, or fallen back from, the display face. If the font file fails or is slow the heading falls back to a metrics-tuned system serif and nothing moves more than a fraction of a line; no information depends on the face.

**Choice: Source Serif 4** (Adobe, SIL Open Font License 1.1; variable, roman only). Why: a sturdy transitional serif designed for screens with an optical-size axis, so it holds up at 56px rank numerals and at 22px h2 without separate files; it has real lining and tabular figures (`lnum`, `tnum`) so the numerals sit square beside Fit; and its tone is newspaper-desk, not fashion or tech, which is the editorial booking desk. It is not a variable-fonts novelty face and not a default stack.

| Item | Value |
|---|---|
| File | one variable `woff2`, roman, subset to Basic Latin + Latin-1 + Latin Extended-A (the headings are English copy and digits), with the `wght` axis limited to 600 to 700 and `opsz` kept; target under 60 KB. Self-hosted from `/fonts/` (CSP `font-src 'self'` already allows it). |
| Weights used | 600 (h2, wordmark) and 700 (h1, rank numerals). Nothing else. |
| Loading | `@font-face { font-family: "Source Serif 4"; font-display: swap; ... }` plus `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the one file. `swap` because text must never be invisible. |
| Fallback | `--font-display: "Source Serif 4", "Source Serif 4 Fallback", Georgia, "Times New Roman", serif`. `"Source Serif 4 Fallback"` is an `@font-face` over `local("Georgia")` with `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override` set so line boxes match; the values are measured when the font file is added and recorded in a comment next to the rule (the build ticket owns the measurement; this spec does not state numbers it has not measured). |
| Numerals | `font-variant-numeric: lining-nums tabular-nums` on rank numerals (Georgia, the fallback, ignores it and uses old-style figures; the fallback is acceptable, not identical). |
| Never | italic, all caps, or letter-spacing on the display face; faux bold; icon fonts. |

```
--font-display: "Source Serif 4", "Source Serif 4 Fallback", Georgia, "Times New Roman", serif;
--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
```

| Token | Size (rem / px) | Line height | Weight | Use |
|---|---|---|---|---|
| `--text-xs` | 0.8125 / 13 | 1.4 | 400 | tertiary labels, evidence timestamps (never the only place a fact appears) |
| `--text-sm` | 0.875 / 14 | 1.5 | 400, 600 | captions, chips, Banner, helper and error text |
| `--text-base` | 1 / 16 | 1.5 | 400, 600 | body, form fields (16px minimum prevents mobile browsers zooming on focus) |
| `--text-md` | 1.125 / 18 | 1.4 | 600 (sans) | card titles (act names), section lead-ins |
| `--text-lg` | 1.375 / 22 | 1.3 | 600 (display) | h2 on mobile |
| `--text-xl` | 1.75 / 28 | 1.2 | 700 (display for h1, sans for Fit) | h1 on mobile, h2 from 768px, Fit on a card |
| `--text-2xl` | 2.5 / 40 | 1.1 | 700 (display for h1 and rank, sans for Fit) | h1 from 1024px, rank numeral on mobile cards, Fit on act detail |
| `--text-3xl` | 3.5 / 56 | 1 | 700 (display) | rank numeral on cards from 768px |

Rules:

- Numbers (Fit, ranks, popularity, mean affinity rank, cell counts) use `font-variant-numeric: tabular-nums`. Digests and entity ids use `--font-mono` at `--text-sm`.
- Max line length 70ch for prose; evidence and tables may be wider.
- Entity names and tag labels are set with `dir="auto"` and `unicode-bidi: plaintext`, wrapped in `<bdi>` where inline next to other text, so a right-to-left name does not reorder the surrounding sentence.
- Use logical properties (`margin-inline`, `padding-block`, `text-align: start`, `inset-inline-start`) everywhere so the chrome mirrors if a right-to-left locale is added.
- Interface text respects user font-size changes: all sizes are `rem`; nothing is clipped at 200% text zoom (see accessibility.md).
- Display sizes (`--text-xl` and up, h1, h2, rank) use `letter-spacing: -0.01em` and `text-wrap: balance`; body never changes tracking.
- Do not use italics for emphasis or all-caps for labels; both hurt readability across scripts.

## 3. Spacing, grid and breakpoints

4px base unit.

| Token | Value | Typical use |
|---|---|---|
| `--space-0` | 0 | |
| `--space-1` | 2px | icon-to-text nudge |
| `--space-2` | 4px | chip internal gap |
| `--space-3` | 8px | gap between adjacent targets (minimum) |
| `--space-4` | 12px | card internal rows |
| `--space-5` | 16px | page gutter on mobile, card padding |
| `--space-6` | 24px | section gap, page gutter on tablet |
| `--space-7` | 32px | page gutter on desktop, large section gap |
| `--space-8` | 48px | page block padding on desktop |
| `--space-9` | 64px | rarely: empty-state vertical padding |

Breakpoints are mobile-first `min-width` queries. Base styles target 360px and must still work at 320px (no horizontal scroll, see accessibility.md).

| Name | Min width | Columns | Gutter | Notes |
|---|---|---|---|---|
| base | 0 (designed at 360) | 4 | 16 | single column, stacked; side-column content (compare, share, summary) sits below the main list |
| `--bp-md` | 768px | 8 | 24 | still one page column; cards gain a two-column interior; side-column content stays below the list |
| `--bp-lg` | 1024px | 12 | 24 | side column appears beside the list (not sticky) |
| `--bp-xl` | 1280px | 12 | 32 | content max width is 80rem (1280px) including gutters; side columns are sticky only here, and only when the column is shorter than the viewport and the viewport is at least 700px tall |
| 1440px (no new query) | 1440px | 12 | 32 | the 1280px layout, centred; the page background fills the extra width; no new columns |

## 4. Radius, borders, elevation

| Token | Value | Use |
|---|---|---|
| `--radius-1` | 4px | inputs, buttons, evidence blocks |
| `--radius-2` | 8px | cards, banner |
| `--radius-pill` | 999px | chips, badges |
| `--border` | 1px solid `--border-control` for controls, 1px solid `--border-subtle` for dividers | |

Elevation is deliberately flat: cards are a 1px hairline border on `--surface`, not a shadow. Interactive cards (ActCard, sample-room cards) change their border to `--accent` on hover and focus, never their elevation.

| Level | Shadow (light / dark) | Use |
|---|---|---|
| 0 | none | everything by default |
| 1 | `--shadow-1`: `0 1px 2px rgb(0 0 0 / 0.08)` / a 1px `--border-control` edge instead | the sticky side column and the sticky action bar (with a 1px `--border-subtle` top rule). Cards never gain a shadow on hover |
| 2 | `--shadow-2` (`--shadow-2-light` / `--shadow-2-dark`) | the copy-confirmation toast, disclosure popovers |

## 5. Motion

Motion explains a change; it never decorates. Nothing moves on its own except the skeleton pulse and the determinate progress bar.

| Token | Value | Use |
|---|---|---|
| `--motion-fast` | 100ms | hover, press |
| `--motion-base` | 200ms | disclosure open and close, toast in |
| `--motion-slow` | 300ms | never exceeded |
| `--ease` | `cubic-bezier(0.2, 0, 0, 1)` | all transitions |

- Allowed: opacity and short (8px) translate for entry; bar width change on CityStrip once, when data lands; skeleton opacity pulse at 1.4s.
- Forbidden: parallax, auto-scrolling, bouncing, number count-up (a count-up would show wrong Fit values mid-animation), reordering animation of the slate list (ranks appear only when final).
- `prefers-reduced-motion: reduce`: all `transition` and `animation` durations become `0.01ms`; the skeleton pulse stops and shows a static `--neutral-bg` fill; bars appear at final width; scroll behaviour is `auto`; toast appears without a slide. Progress text and live-region announcements are unchanged, because they carry the information.
- No flashing content: nothing blinks more than once per second (WCAG 2.3.1).

## 6. Focus ring, touch targets, interaction sizes

Focus ring (all interactive elements, keyboard only via `:focus-visible`):

```
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: inherit; }
```

- The 2px offset leaves a gap of page background between the ring and the control, so the ring is measured against the surface it sits on. Ring-to-surface ratios are in the contrast tables (every surface a focusable control can sit on: canvas, surface, sunken, banner, selected row).
- Ring is 3px thick (above the 2px minimum area of WCAG 2.4.13) and never removed with `outline: none` without this replacement. Inputs get the same ring plus no change of border colour (colour change alone is not the cue). Selected and error borders never change width (that would move the layout): they keep a 1px border and add an inset ring, `box-shadow: inset 0 0 0 1px {colour}`, for a 2px visual weight.
- Focus must not be hidden by sticky UI (WCAG 2.4.11): there is no sticky header; the desktop side column is sticky but does not overlap the main column. The only sticky bar on small screens is the room-setup action bar (components.md, ActionBar). It is sticky only when the viewport is at least 700px tall (`@media (min-height: 700px)`), so it is static at 200% zoom and 320px where it would eat the screen, and the page sets `scroll-padding-block-end` equal to the bar height so a focused field is never covered. Set `scroll-margin-block: 24px` on headings and focus targets.
- Skip link is the first focusable element, becomes visible on focus, and uses the same ring.

Target sizes (WCAG 2.5.8 minimum 24 by 24 CSS px; this system is stricter):

| Context | Minimum target | Spacing between adjacent targets |
|---|---|---|
| Below 768px, and any `(pointer: coarse)` | 44 by 44 px (the hit area; the visible glyph may be smaller, extend with padding) | 8px |
| 768px and up with fine pointer | 32 by 32 px (never below 24 by 24) | 8px |
| Inline text links inside a sentence | exempt by the inline exception, but the line height is at least 1.5 | |

## 7. Status system (icon plus label plus colour)

Each status has one icon shape, one fixed text label and one colour pair. A status is never rendered with only one of the three. Icons are inline SVG, 16px (20px in a 44px target), `aria-hidden="true"`, with the label as real text next to them. `currentColor` takes the status `-fg` colour. Icons are line style, 1.5px stroke, square ends.

| Status | Icon (shape) | Default label | Colour pair | Where |
|---|---|---|---|---|
| Ok / confirmed | circle with a check | "Matched", "Done" | ok | match confirmed, run done |
| Caveat | triangle with an exclamation mark | "Caveat" plus a specific short label | caution | caveat chips, partial results |
| Thin data | three short bars, the last one dotted | "Thin data" | caution | ThinDataBadge, CityStrip |
| Unavailable / no data | circle with a horizontal dash | "Unavailable", "No data" | neutral | Fit unavailable, no data |
| Error | octagon with an X | "Error" plus message | error | failed run, field errors |
| Info / progress | circle with an "i" | "Note", "Working" | info | progress, notes |
| Standing: above / similar / below | a horizontal median line with a dot above, on, or below it | "Above crowd median", "Similar to crowd median", "Below crowd median" | neutral | standing line |

The standing glyph is a position relative to a line, not an arrow, and uses the neutral colours, so it cannot be read as growth, decline or good or bad.

## 8. Data marks

- **Fit** is a number with one decimal, never a bar, ring, star rating or percentage sign. A bar from 0 to 100 would put every act at roughly 60 and invite the reading "60% match". Rank is shown beside it. A spread below the single close-values constant `FIT_CLOSE_SPREAD_POINTS` (5 points, a design proposal to be added to core and ADR 0013; the recorded sample's three acts span 2.5 points, which is only an example) triggers the same note on the slate and the act detail screens.
- **Three different scales, never mixed.** Fit is 0 to 100 (mean Qloo tag score). Qloo popularity rank is a 0 to 100 percentile of how well known an act is on Qloo, printed "{value} of 100" with "higher is better known on Qloo". Mean affinity rank is 0 to 1, the average of Qloo's per-cell `affinity_rank` for a city, and has nothing to do with the other two. Positions in an ordered list (rank 1, 2, 3) are called "Fit position" or "Popularity position" where two orders are compared.
- **Mean affinity rank** (0 to 1) is a horizontal bar on a track with the number printed at the end (3 decimals) and the cell count printed beside it. A bar is allowed here because mean affinity rank is a bounded rank. The bar has a text value so it is never read by shape alone. Thin-data cities use a diagonal-hatch fill (SVG pattern, 4px) in the caution colours and the ThinDataBadge; the hatch is a second cue besides the colour and the badge.
- Tag scores in shared tastes are printed as numbers with two decimals; no bar.
- No chart axes, legends, gridlines or colour scales appear anywhere; there is nothing to decode.

## 9. The single CSS token block

One file (`app/tokens.css` in the build, ADR 0005). `light-dark()` keeps light and dark values side by side, so they cannot drift apart. Colour values here must match the token reference table above; the contrast script checks the pair tables, so a mismatch between this block and the tables is caught in review (M1-05 adds a unit test that reads both).

```css
:root {
  color-scheme: light dark;

  /* colour: semantic, light then dark */
  --canvas: light-dark(#F7F5F0, #111013);
  --surface: light-dark(#FFFFFF, #1A191D);
  --sunken: light-dark(#EEEBE3, #0B0B0D);
  --text: light-dark(#14130F, #EDEBE6);
  --text-muted: light-dark(#55524D, #ABA8B2);
  --link: light-dark(#4A35C8, #B3A6FF);
  --accent: light-dark(#4A35C8, #B3A6FF);
  --accent-hover: light-dark(#3826A6, #CCC3FF);
  --on-accent: light-dark(#FFFFFF, #17113F);
  --accent-tint: light-dark(#ECE9FB, #25204A);
  --focus: light-dark(#0A5FD0, #8DBDF5);
  --border-control: light-dark(#6B675F, #8B8795);
  --border-subtle: light-dark(#D9D5CA, #302E35);
  --track: light-dark(#DDD9CF, #3B3943);
  --banner-bg: light-dark(#FFF4D6, #3A2F10);
  --banner-fg: light-dark(#3A2D00, #FBE9B5);
  --banner-border: light-dark(#7A5A00, #C9A23A);
  --ok-bg: light-dark(#E3F3E7, #15301C);
  --ok-fg: light-dark(#14532D, #A5E0B2);
  --caution-bg: light-dark(#FFF0CF, #3A2A0A);
  --caution-fg: light-dark(#6B4200, #F3C873);
  --error-bg: light-dark(#FBE5E2, #401614);
  --error-fg: light-dark(#8F1D1D, #FFB3AC);
  --info-bg: light-dark(#E2EEFA, #122A40);
  --info-fg: light-dark(#0B4F8A, #A3CFF7);
  --neutral-bg: light-dark(#EAE8E1, #2C2A27);
  --neutral-fg: light-dark(#45423D, #D2CEC5);

  /* type */
  --font-display: "Source Serif 4", "Source Serif 4 Fallback", Georgia, "Times New Roman", serif;
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
  --text-xs: 0.8125rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-md: 1.125rem;
  --text-lg: 1.375rem;
  --text-xl: 1.75rem;
  --text-2xl: 2.5rem;
  --text-3xl: 3.5rem;

  /* space */
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 8px;
  --space-4: 12px;
  --space-5: 16px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 48px;
  --space-9: 64px;

  /* shape */
  --radius-1: 4px;
  --radius-2: 8px;
  --radius-pill: 999px;
  --shadow-1: light-dark(0 1px 2px rgb(0 0 0 / 0.08), 0 0 0 1px var(--border-control));
  --shadow-2-dark: 0 4px 16px rgb(0 0 0 / 0.5);
  --shadow-2-light: 0 4px 16px rgb(0 0 0 / 0.16);
  --shadow-2: light-dark(var(--shadow-2-light), var(--shadow-2-dark));

  /* motion */
  --motion-fast: 100ms;
  --motion-base: 200ms;
  --motion-slow: 300ms;
  --ease: cubic-bezier(0.2, 0, 0, 1);

  /* target size: 44px on small screens and coarse pointers, 32px otherwise */
  --target: 44px;

  /* layout */
  --content-max: 80rem;
  --gutter: 16px;
}

:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }

@media (min-width: 768px) { :root { --gutter: 24px; } }
@media (min-width: 768px) and (pointer: fine) { :root { --target: 32px; } }
@media (min-width: 1280px) { :root { --gutter: 32px; } }

@media (prefers-reduced-motion: reduce) {
  :root { --motion-fast: 0.01ms; --motion-base: 0.01ms; --motion-slow: 0.01ms; }
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}

:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: inherit; }
```

Breakpoint values (`--bp-*`) cannot be custom properties inside media queries, so they appear as literal `768px`, `1024px`, `1280px` in the CSS and are listed in section 3.

## 10. Do and do not

| Do | Do not |
|---|---|
| Print the number and the label: "Fit 60.6", "Qloo popularity rank" | Show a score as a star rating, ring, gauge or percentage |
| Show rank first, Fit second, and say when values are close | Imply large gaps between neighbouring Fit values |
| Pair every status colour with an icon and a word | Use red or green alone, or green for "above" popularity |
| Use "audience-taste fit" in prose and "Fit" as the short label | Use any word that implies sales, attendance or prediction |
| Keep the Banner on every screen, not dismissible | Hide the Banner on small screens or after first view |
| Show "No data" or "Unavailable" with the reason | Show a zero, a dash with no reason, or a hidden card |
| Say nothing about change over time (trending data is flat here) | Use arrows, sparklines, "rising", "growing", "momentum" |
| Use `--accent` for exactly: wordmark mark, primary fill, links and tertiary buttons, rank numerals, selected state | Add a second brand colour, tint a card header with the accent, or use the accent for a status |
| One primary button per region (filled accent), secondary outlined, tertiary a text link | Box and underline the same control; make every button the same outlined style |
| Make a whole card one link (stretched link on "Open details") with at most one quiet secondary link | Put three links in a row at the foot of a card |
| Set h1, h2, the wordmark and rank numerals in `--font-display`; everything else, including all entity names, in `--font-sans` | Use the display face for body, chips, tables, numbers other than the rank, or any third-party string |
| Let hierarchy come from type size, weight and whitespace; use a hairline rule to group | Box every group, nest cards, or add a shadow to separate things |
| Say a caveat sentence once per card and name the cities in the chip | Repeat a caveat sentence once per city |
| Collapse long generated prose behind a disclosure below the ranked list; keep its provenance line visible | Put ten near-identical sentences above the ranking |
