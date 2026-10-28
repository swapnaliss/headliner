# Contrast report (M3-06)

Generated 2026-10-28 by `node scripts/check-contrast.mjs docs/design/design-system.md` (exit 0). The script reads the token table in `design-system.md`; `apps/web/test/ui/tokens.test.ts` keeps `apps/web/app/tokens.css` equal to that table, so these are the shipped colours.

Result: 104 pairs PASS, 0 FAIL. Thresholds: 4.5 for text, 3 for large text and UI components (focus ring, borders, bars).

- light: 52 pairs; tightest margin link on sunken at 5.74 (needs 4.5).
- dark: 52 pairs; tightest margin text-muted on accent-tint at 6.10 (needs 4.5).

Real rendering is additionally checked by axe `color-contrast` on every route and state in light and dark (see `docs/evidence/ui-review-m3.md`).

## Light

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---|---|---|
| text on canvas | #1C1B1A | #FAF9F6 | 16.33 | 4.5 | PASS |
| text on surface | #1C1B1A | #FFFFFF | 17.19 | 4.5 | PASS |
| text on sunken | #1C1B1A | #F0EEE8 | 14.82 | 4.5 | PASS |
| text-muted on canvas | #55524D | #FAF9F6 | 7.38 | 4.5 | PASS |
| text-muted on surface | #55524D | #FFFFFF | 7.77 | 4.5 | PASS |
| text-muted on sunken | #55524D | #F0EEE8 | 6.70 | 4.5 | PASS |
| placeholder (text-muted) on surface | #55524D | #FFFFFF | 7.77 | 4.5 | PASS |
| disabled primary button text (text-muted) on sunken | #55524D | #F0EEE8 | 6.70 | 4.5 | PASS |
| disabled primary button border (border-control) on sunken | #6B675F | #F0EEE8 | 4.85 | 3 | PASS |
| link on canvas | #0B5CAD | #FAF9F6 | 6.33 | 4.5 | PASS |
| link on surface | #0B5CAD | #FFFFFF | 6.66 | 4.5 | PASS |
| link on banner | #0B5CAD | #FFF4D6 | 6.08 | 4.5 | PASS |
| primary button text on accent | #FFFFFF | #1F4E5F | 9.07 | 4.5 | PASS |
| primary button text on accent-hover | #FFFFFF | #173B48 | 11.96 | 4.5 | PASS |
| secondary button text on surface | #1F4E5F | #FFFFFF | 9.07 | 4.5 | PASS |
| secondary button border on surface | #1F4E5F | #FFFFFF | 9.07 | 3 | PASS |
| text on selected row (accent-tint) | #1C1B1A | #E3EEF1 | 14.54 | 4.5 | PASS |
| selected row border (accent) on surface | #1F4E5F | #FFFFFF | 9.07 | 3 | PASS |
| input border on surface | #6B675F | #FFFFFF | 5.62 | 3 | PASS |
| input border on canvas | #6B675F | #FAF9F6 | 5.34 | 3 | PASS |
| focus ring on canvas | #0A5FD0 | #FAF9F6 | 5.60 | 3 | PASS |
| focus ring on surface | #0A5FD0 | #FFFFFF | 5.89 | 3 | PASS |
| focus ring on sunken | #0A5FD0 | #F0EEE8 | 5.08 | 3 | PASS |
| focus ring on banner | #0A5FD0 | #FFF4D6 | 5.38 | 3 | PASS |
| focus ring on accent-tint | #0A5FD0 | #E3EEF1 | 4.98 | 3 | PASS |
| banner text | #3A2D00 | #FFF4D6 | 12.32 | 4.5 | PASS |
| banner border on canvas | #7A5A00 | #FAF9F6 | 6.06 | 3 | PASS |
| ok status text and icon | #14532D | #E3F3E7 | 7.91 | 4.5 | PASS |
| ok status border on surface | #14532D | #FFFFFF | 9.11 | 3 | PASS |
| caution (caveat, thin data) text and icon | #6B4200 | #FFF0CF | 7.74 | 4.5 | PASS |
| caution border on surface | #6B4200 | #FFFFFF | 8.73 | 3 | PASS |
| error status text and icon | #8F1D1D | #FBE5E2 | 7.37 | 4.5 | PASS |
| error border on surface | #8F1D1D | #FFFFFF | 8.89 | 3 | PASS |
| error text on surface (field message) | #8F1D1D | #FFFFFF | 8.89 | 4.5 | PASS |
| info status text and icon | #0B4F8A | #E2EEFA | 7.13 | 4.5 | PASS |
| info border on surface | #0B4F8A | #FFFFFF | 8.40 | 3 | PASS |
| neutral (unavailable, standing) text and icon | #45423D | #EAE8E1 | 8.15 | 4.5 | PASS |
| neutral border on surface | #45423D | #FFFFFF | 10.00 | 3 | PASS |
| chip border on surface | #6B675F | #FFFFFF | 5.62 | 3 | PASS |
| chip text on neutral-bg | #45423D | #EAE8E1 | 8.15 | 4.5 | PASS |
| strength bar fill on track | #1F4E5F | #DDD9CF | 6.44 | 3 | PASS |
| strength bar fill on surface | #1F4E5F | #FFFFFF | 9.07 | 3 | PASS |
| thin-data bar fill (hatched) on track | #6B4200 | #DDD9CF | 6.19 | 3 | PASS |
| link on sunken | #0B5CAD | #F0EEE8 | 5.74 | 4.5 | PASS |
| text-muted on accent-tint | #55524D | #E3EEF1 | 6.57 | 4.5 | PASS |
| focus ring on error-bg | #0A5FD0 | #FBE5E2 | 4.88 | 3 | PASS |
| focus ring on neutral-bg | #0A5FD0 | #EAE8E1 | 4.81 | 3 | PASS |
| focus ring on caution-bg | #0A5FD0 | #FFF0CF | 5.22 | 3 | PASS |
| focus ring on info-bg | #0A5FD0 | #E2EEFA | 5.01 | 3 | PASS |
| focus ring on ok-bg | #0A5FD0 | #E3F3E7 | 5.12 | 3 | PASS |
| bar value text on surface | #1C1B1A | #FFFFFF | 17.19 | 4.5 | PASS |
| progress fill (info) on track | #0B4F8A | #DDD9CF | 5.96 | 3 | PASS |

## Dark

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---|---|---|
| text on canvas | #ECE9E3 | #141311 | 15.32 | 4.5 | PASS |
| text on surface | #ECE9E3 | #1D1C1A | 14.05 | 4.5 | PASS |
| text on sunken | #ECE9E3 | #0E0D0C | 16.02 | 4.5 | PASS |
| text-muted on canvas | #B0ABA2 | #141311 | 8.12 | 4.5 | PASS |
| text-muted on surface | #B0ABA2 | #1D1C1A | 7.45 | 4.5 | PASS |
| text-muted on sunken | #B0ABA2 | #0E0D0C | 8.49 | 4.5 | PASS |
| placeholder (text-muted) on surface | #B0ABA2 | #1D1C1A | 7.45 | 4.5 | PASS |
| disabled primary button text (text-muted) on sunken | #B0ABA2 | #0E0D0C | 8.49 | 4.5 | PASS |
| disabled primary button border (border-control) on sunken | #8A857B | #0E0D0C | 5.29 | 3 | PASS |
| link on canvas | #7FB6F0 | #141311 | 8.71 | 4.5 | PASS |
| link on surface | #7FB6F0 | #1D1C1A | 7.98 | 4.5 | PASS |
| link on banner | #7FB6F0 | #3A2F10 | 6.18 | 4.5 | PASS |
| primary button text on accent | #0F2630 | #8EC5D4 | 8.27 | 4.5 | PASS |
| primary button text on accent-hover | #0F2630 | #A9D5E1 | 9.91 | 4.5 | PASS |
| secondary button text on surface | #8EC5D4 | #1D1C1A | 8.99 | 4.5 | PASS |
| secondary button border on surface | #8EC5D4 | #1D1C1A | 8.99 | 3 | PASS |
| text on selected row (accent-tint) | #ECE9E3 | #1B2F36 | 11.50 | 4.5 | PASS |
| selected row border (accent) on surface | #8EC5D4 | #1D1C1A | 8.99 | 3 | PASS |
| input border on surface | #8A857B | #1D1C1A | 4.63 | 3 | PASS |
| input border on canvas | #8A857B | #141311 | 5.05 | 3 | PASS |
| focus ring on canvas | #8DBDF5 | #141311 | 9.48 | 3 | PASS |
| focus ring on surface | #8DBDF5 | #1D1C1A | 8.70 | 3 | PASS |
| focus ring on sunken | #8DBDF5 | #0E0D0C | 9.92 | 3 | PASS |
| focus ring on banner | #8DBDF5 | #3A2F10 | 6.73 | 3 | PASS |
| focus ring on accent-tint | #8DBDF5 | #1B2F36 | 7.12 | 3 | PASS |
| banner text | #FBE9B5 | #3A2F10 | 10.93 | 4.5 | PASS |
| banner border on canvas | #C9A23A | #141311 | 7.70 | 3 | PASS |
| ok status text and icon | #A5E0B2 | #15301C | 9.44 | 4.5 | PASS |
| ok status border on surface | #A5E0B2 | #1D1C1A | 11.27 | 3 | PASS |
| caution (caveat, thin data) text and icon | #F3C873 | #3A2A0A | 8.78 | 4.5 | PASS |
| caution border on surface | #F3C873 | #1D1C1A | 10.80 | 3 | PASS |
| error status text and icon | #FFB3AC | #401614 | 9.15 | 4.5 | PASS |
| error border on surface | #FFB3AC | #1D1C1A | 9.97 | 3 | PASS |
| error text on surface (field message) | #FFB3AC | #1D1C1A | 9.97 | 4.5 | PASS |
| info status text and icon | #A3CFF7 | #122A40 | 8.96 | 4.5 | PASS |
| info border on surface | #A3CFF7 | #1D1C1A | 10.39 | 3 | PASS |
| neutral (unavailable, standing) text and icon | #D2CEC5 | #2C2A27 | 9.11 | 4.5 | PASS |
| neutral border on surface | #D2CEC5 | #1D1C1A | 10.84 | 3 | PASS |
| chip border on surface | #8A857B | #1D1C1A | 4.63 | 3 | PASS |
| chip text on neutral-bg | #D2CEC5 | #2C2A27 | 9.11 | 4.5 | PASS |
| strength bar fill on track | #8EC5D4 | #3D3B37 | 5.90 | 3 | PASS |
| strength bar fill on surface | #8EC5D4 | #1D1C1A | 8.99 | 3 | PASS |
| thin-data bar fill (hatched) on track | #F3C873 | #3D3B37 | 7.08 | 3 | PASS |
| link on sunken | #7FB6F0 | #0E0D0C | 9.10 | 4.5 | PASS |
| text-muted on accent-tint | #B0ABA2 | #1B2F36 | 6.10 | 4.5 | PASS |
| focus ring on error-bg | #8DBDF5 | #401614 | 7.99 | 3 | PASS |
| focus ring on neutral-bg | #8DBDF5 | #2C2A27 | 7.31 | 3 | PASS |
| focus ring on caution-bg | #8DBDF5 | #3A2A0A | 7.08 | 3 | PASS |
| focus ring on info-bg | #8DBDF5 | #122A40 | 7.49 | 3 | PASS |
| focus ring on ok-bg | #8DBDF5 | #15301C | 7.29 | 3 | PASS |
| bar value text on surface | #ECE9E3 | #1D1C1A | 14.05 | 4.5 | PASS |
| progress fill (info) on track | #A3CFF7 | #3D3B37 | 6.82 | 3 | PASS |
