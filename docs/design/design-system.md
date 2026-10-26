# Design system

Tokens and rules every Headliner screen is built from. Components are in [components.md](components.md), accessibility checks in [accessibility.md](accessibility.md). Contrast ratios in this file are computed by `scripts/check-contrast.mjs`, not by hand.

## Direction in one paragraph

Headliner is a decision tool for an independent venue's talent buyer, so the look is a calm, dense working document: a warm off-white page (near-black in dark mode), flat bordered surfaces instead of shadows, one deep teal accent used only for actions and the selected state, and status colours that always travel with an icon and a word. Numbers are set in tabular figures so columns of Fit and rank line up. There is no hero image, no gradient, no emoji and no decorative chart: every mark on screen is either text, a control, or a value with evidence behind it.

## 1. Colour tokens

All tokens are semantic (`--text`, `--surface`), never named after a hue. Light and dark values live in one place (section 9) using `light-dark()`. Dark mode follows `prefers-color-scheme`; a `data-theme="light|dark"` attribute on `<html>` overrides it.

Rules:

- Body text and any text in a component: 4.5:1 minimum. Large text, icons that carry meaning, input borders, focus ring, bar fills: 3:1 minimum. Every pairing used by a component is in the tables below; adding a new pairing means adding a row and running the script.
- Status is never colour alone. Every status has an icon (shape differs per status) and a text label (see section 7). The colours below only reinforce.
- Standing ("Qloo popularity rank") uses the neutral status colours only. Above, similar and below are not good or bad, and the glyphs are not arrows, because arrows read as a trend and the trending data in this environment is flat.
- Disabled controls are exempt from WCAG contrast but are still kept legible (muted text on sunken), and the reason for a disabled action is always written next to it (see components.md, Button).
- Skeleton fills and decorative hairlines (`--border-subtle`) carry no information and are exempt; they are never the only cue for anything.

### Token reference

| Token | Light | Dark | Use |
|---|---|---|---|
| `--canvas` | `#FAF9F6` | `#141311` | page background |
| `--surface` | `#FFFFFF` | `#1D1C1A` | cards, inputs, popovers |
| `--sunken` | `#F0EEE8` | `#0E0D0C` | code and evidence blocks, table stripes |
| `--text` | `#1C1B1A` | `#ECE9E3` | body and headings |
| `--text-muted` | `#55524D` | `#B0ABA2` | captions, helper text, placeholder |
| `--link` | `#0B5CAD` | `#7FB6F0` | inline links (also underlined) |
| `--accent` | `#1F4E5F` | `#8EC5D4` | primary button fill, selected border, bar fill |
| `--accent-hover` | `#173B48` | `#A9D5E1` | primary button hover |
| `--on-accent` | `#FFFFFF` | `#0F2630` | text on primary button |
| `--accent-tint` | `#E3EEF1` | `#1B2F36` | selected row background |
| `--focus` | `#0A5FD0` | `#8DBDF5` | focus ring |
| `--border-control` | `#6B675F` | `#8A857B` | input, checkbox, radio, chip borders |
| `--border-subtle` | `#D8D4CA` | `#33312E` | decorative dividers only |
| `--track` | `#DDD9CF` | `#3D3B37` | bar track |
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
| light: text on canvas | `#1C1B1A` | `#FAF9F6` | 4.5 | 16.33 |
| light: text on surface | `#1C1B1A` | `#FFFFFF` | 4.5 | 17.19 |
| light: text on sunken | `#1C1B1A` | `#F0EEE8` | 4.5 | 14.82 |
| light: text-muted on canvas | `#55524D` | `#FAF9F6` | 4.5 | 7.38 |
| light: text-muted on surface | `#55524D` | `#FFFFFF` | 4.5 | 7.77 |
| light: text-muted on sunken | `#55524D` | `#F0EEE8` | 4.5 | 6.70 |
| light: placeholder (text-muted) on surface | `#55524D` | `#FFFFFF` | 4.5 | 7.77 |
| light: link on canvas | `#0B5CAD` | `#FAF9F6` | 4.5 | 6.33 |
| light: link on surface | `#0B5CAD` | `#FFFFFF` | 4.5 | 6.66 |
| light: link on banner | `#0B5CAD` | `#FFF4D6` | 4.5 | 6.08 |
| light: primary button text on accent | `#FFFFFF` | `#1F4E5F` | 4.5 | 9.07 |
| light: primary button text on accent-hover | `#FFFFFF` | `#173B48` | 4.5 | 11.96 |
| light: secondary button text on surface | `#1F4E5F` | `#FFFFFF` | 4.5 | 9.07 |
| light: secondary button border on surface | `#1F4E5F` | `#FFFFFF` | 3 | 9.07 |
| light: text on selected row (accent-tint) | `#1C1B1A` | `#E3EEF1` | 4.5 | 14.54 |
| light: selected row border (accent) on surface | `#1F4E5F` | `#FFFFFF` | 3 | 9.07 |
| light: input border on surface | `#6B675F` | `#FFFFFF` | 3 | 5.62 |
| light: input border on canvas | `#6B675F` | `#FAF9F6` | 3 | 5.34 |
| light: focus ring on canvas | `#0A5FD0` | `#FAF9F6` | 3 | 5.60 |
| light: focus ring on surface | `#0A5FD0` | `#FFFFFF` | 3 | 5.89 |
| light: focus ring on sunken | `#0A5FD0` | `#F0EEE8` | 3 | 5.08 |
| light: focus ring on banner | `#0A5FD0` | `#FFF4D6` | 3 | 5.38 |
| light: focus ring on accent-tint | `#0A5FD0` | `#E3EEF1` | 3 | 4.98 |
| light: banner text | `#3A2D00` | `#FFF4D6` | 4.5 | 12.32 |
| light: banner border on canvas | `#7A5A00` | `#FAF9F6` | 3 | 6.06 |
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
| light: strength bar fill on track | `#1F4E5F` | `#DDD9CF` | 3 | 6.44 |
| light: strength bar fill on surface | `#1F4E5F` | `#FFFFFF` | 3 | 9.07 |
| light: thin-data bar fill (hatched) on track | `#6B4200` | `#DDD9CF` | 3 | 6.19 |
| light: link on sunken | `#0B5CAD` | `#F0EEE8` | 4.5 | 5.74 |
| light: text-muted on accent-tint | `#55524D` | `#E3EEF1` | 4.5 | 6.57 |
| light: focus ring on error-bg | `#0A5FD0` | `#FBE5E2` | 3 | 4.88 |
| light: focus ring on neutral-bg | `#0A5FD0` | `#EAE8E1` | 3 | 4.81 |
| light: focus ring on caution-bg | `#0A5FD0` | `#FFF0CF` | 3 | 5.22 |
| light: focus ring on info-bg | `#0A5FD0` | `#E2EEFA` | 3 | 5.01 |
| light: focus ring on ok-bg | `#0A5FD0` | `#E3F3E7` | 3 | 5.12 |
| light: bar value text on surface | `#1C1B1A` | `#FFFFFF` | 4.5 | 17.19 |
| light: progress fill (info) on track | `#0B4F8A` | `#DDD9CF` | 3 | 5.96 |

### Contrast, dark

| Pair | Foreground | Background | Required | Ratio |
|---|---|---|---|---|
| dark: text on canvas | `#ECE9E3` | `#141311` | 4.5 | 15.32 |
| dark: text on surface | `#ECE9E3` | `#1D1C1A` | 4.5 | 14.05 |
| dark: text on sunken | `#ECE9E3` | `#0E0D0C` | 4.5 | 16.02 |
| dark: text-muted on canvas | `#B0ABA2` | `#141311` | 4.5 | 8.12 |
| dark: text-muted on surface | `#B0ABA2` | `#1D1C1A` | 4.5 | 7.45 |
| dark: text-muted on sunken | `#B0ABA2` | `#0E0D0C` | 4.5 | 8.49 |
| dark: placeholder (text-muted) on surface | `#B0ABA2` | `#1D1C1A` | 4.5 | 7.45 |
| dark: link on canvas | `#7FB6F0` | `#141311` | 4.5 | 8.71 |
| dark: link on surface | `#7FB6F0` | `#1D1C1A` | 4.5 | 7.98 |
| dark: link on banner | `#7FB6F0` | `#3A2F10` | 4.5 | 6.18 |
| dark: primary button text on accent | `#0F2630` | `#8EC5D4` | 4.5 | 8.27 |
| dark: primary button text on accent-hover | `#0F2630` | `#A9D5E1` | 4.5 | 9.91 |
| dark: secondary button text on surface | `#8EC5D4` | `#1D1C1A` | 4.5 | 8.99 |
| dark: secondary button border on surface | `#8EC5D4` | `#1D1C1A` | 3 | 8.99 |
| dark: text on selected row (accent-tint) | `#ECE9E3` | `#1B2F36` | 4.5 | 11.50 |
| dark: selected row border (accent) on surface | `#8EC5D4` | `#1D1C1A` | 3 | 8.99 |
| dark: input border on surface | `#8A857B` | `#1D1C1A` | 3 | 4.63 |
| dark: input border on canvas | `#8A857B` | `#141311` | 3 | 5.05 |
| dark: focus ring on canvas | `#8DBDF5` | `#141311` | 3 | 9.48 |
| dark: focus ring on surface | `#8DBDF5` | `#1D1C1A` | 3 | 8.70 |
| dark: focus ring on sunken | `#8DBDF5` | `#0E0D0C` | 3 | 9.92 |
| dark: focus ring on banner | `#8DBDF5` | `#3A2F10` | 3 | 6.73 |
| dark: focus ring on accent-tint | `#8DBDF5` | `#1B2F36` | 3 | 7.12 |
| dark: banner text | `#FBE9B5` | `#3A2F10` | 4.5 | 10.93 |
| dark: banner border on canvas | `#C9A23A` | `#141311` | 3 | 7.70 |
| dark: ok status text and icon | `#A5E0B2` | `#15301C` | 4.5 | 9.44 |
| dark: ok status border on surface | `#A5E0B2` | `#1D1C1A` | 3 | 11.27 |
| dark: caution (caveat, thin data) text and icon | `#F3C873` | `#3A2A0A` | 4.5 | 8.78 |
| dark: caution border on surface | `#F3C873` | `#1D1C1A` | 3 | 10.80 |
| dark: error status text and icon | `#FFB3AC` | `#401614` | 4.5 | 9.15 |
| dark: error border on surface | `#FFB3AC` | `#1D1C1A` | 3 | 9.97 |
| dark: error text on surface (field message) | `#FFB3AC` | `#1D1C1A` | 4.5 | 9.97 |
| dark: info status text and icon | `#A3CFF7` | `#122A40` | 4.5 | 8.96 |
| dark: info border on surface | `#A3CFF7` | `#1D1C1A` | 3 | 10.39 |
| dark: neutral (unavailable, standing) text and icon | `#D2CEC5` | `#2C2A27` | 4.5 | 9.11 |
| dark: neutral border on surface | `#D2CEC5` | `#1D1C1A` | 3 | 10.84 |
| dark: chip border on surface | `#8A857B` | `#1D1C1A` | 3 | 4.63 |
| dark: chip text on neutral-bg | `#D2CEC5` | `#2C2A27` | 4.5 | 9.11 |
| dark: strength bar fill on track | `#8EC5D4` | `#3D3B37` | 3 | 5.90 |
| dark: strength bar fill on surface | `#8EC5D4` | `#1D1C1A` | 3 | 8.99 |
| dark: thin-data bar fill (hatched) on track | `#F3C873` | `#3D3B37` | 3 | 7.08 |
| dark: link on sunken | `#7FB6F0` | `#0E0D0C` | 4.5 | 9.10 |
| dark: text-muted on accent-tint | `#B0ABA2` | `#1B2F36` | 4.5 | 6.10 |
| dark: focus ring on error-bg | `#8DBDF5` | `#401614` | 3 | 7.99 |
| dark: focus ring on neutral-bg | `#8DBDF5` | `#2C2A27` | 3 | 7.31 |
| dark: focus ring on caution-bg | `#8DBDF5` | `#3A2A0A` | 3 | 7.08 |
| dark: focus ring on info-bg | `#8DBDF5` | `#122A40` | 3 | 7.49 |
| dark: focus ring on ok-bg | `#8DBDF5` | `#15301C` | 3 | 7.29 |
| dark: bar value text on surface | `#ECE9E3` | `#1D1C1A` | 4.5 | 14.05 |
| dark: progress fill (info) on track | `#A3CFF7` | `#3D3B37` | 3 | 6.82 |

Re-run after any token change: `node scripts/check-contrast.mjs docs/design/design-system.md`. M3-06 re-runs it as part of the audit.

## 2. Typography

System font stack, no web fonts: no network cost, and the operating system supplies Latin, Cyrillic, Greek, CJK, Arabic, Hebrew and Devanagari glyphs for entity names. Layout never assumes a Latin width.

```
--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
```

| Token | Size (rem / px) | Line height | Weight | Use |
|---|---|---|---|---|
| `--text-xs` | 0.8125 / 13 | 1.4 | 400 | tertiary labels, evidence timestamps (never the only place a fact appears) |
| `--text-sm` | 0.875 / 14 | 1.5 | 400, 600 | captions, chips, Banner, helper and error text |
| `--text-base` | 1 / 16 | 1.5 | 400, 600 | body, form fields (16px minimum prevents mobile browsers zooming on focus) |
| `--text-md` | 1.125 / 18 | 1.4 | 600 | card titles (act names), section lead-ins |
| `--text-lg` | 1.375 / 22 | 1.3 | 700 | h2, Fit on a card |
| `--text-xl` | 1.75 / 28 | 1.25 | 700 | h1 on mobile |
| `--text-2xl` | 2.25 / 36 | 1.2 | 700 | h1 on desktop, Fit on act detail |

Rules:

- Numbers (Fit, ranks, popularity, mean affinity rank, cell counts) use `font-variant-numeric: tabular-nums`. Digests and entity ids use `--font-mono` at `--text-sm`.
- Max line length 70ch for prose; evidence and tables may be wider.
- Entity names and tag labels are set with `dir="auto"` and `unicode-bidi: plaintext`, wrapped in `<bdi>` where inline next to other text, so a right-to-left name does not reorder the surrounding sentence.
- Use logical properties (`margin-inline`, `padding-block`, `text-align: start`, `inset-inline-start`) everywhere so the chrome mirrors if a right-to-left locale is added.
- Interface text respects user font-size changes: all sizes are `rem`; nothing is clipped at 200% text zoom (see accessibility.md).
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

Elevation is deliberately flat: cards are a 1px border on `--surface`, not a shadow.

| Level | Shadow (light / dark) | Use |
|---|---|---|
| 0 | none | everything by default |
| 1 | `--shadow-1`: `0 1px 2px rgb(0 0 0 / 0.08)` / a 1px `--border-control` edge instead | the sticky side column only. Non-interactive cards (ActCard) never change elevation on hover |
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
- Focus must not be hidden by sticky UI (WCAG 2.4.11): there is no sticky header or footer on mobile; the desktop side column is sticky but does not overlap the main column. Set `scroll-margin-block: 24px` on headings and focus targets.
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
  --canvas: light-dark(#FAF9F6, #141311);
  --surface: light-dark(#FFFFFF, #1D1C1A);
  --sunken: light-dark(#F0EEE8, #0E0D0C);
  --text: light-dark(#1C1B1A, #ECE9E3);
  --text-muted: light-dark(#55524D, #B0ABA2);
  --link: light-dark(#0B5CAD, #7FB6F0);
  --accent: light-dark(#1F4E5F, #8EC5D4);
  --accent-hover: light-dark(#173B48, #A9D5E1);
  --on-accent: light-dark(#FFFFFF, #0F2630);
  --accent-tint: light-dark(#E3EEF1, #1B2F36);
  --focus: light-dark(#0A5FD0, #8DBDF5);
  --border-control: light-dark(#6B675F, #8A857B);
  --border-subtle: light-dark(#D8D4CA, #33312E);
  --track: light-dark(#DDD9CF, #3D3B37);
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
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
  --text-xs: 0.8125rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-md: 1.125rem;
  --text-lg: 1.375rem;
  --text-xl: 1.75rem;
  --text-2xl: 2.25rem;

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
