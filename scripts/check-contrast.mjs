#!/usr/bin/env node
// WCAG 2.2 contrast checker for the token tables in docs/design/design-system.md.
//
// Usage:
//   node scripts/check-contrast.mjs docs/design/design-system.md           check only
//   node scripts/check-contrast.mjs docs/design/design-system.md --update  also rewrite the Ratio column
//
// Table format (any markdown table whose header row has these column names, case-insensitive,
// in any order; other tables are ignored):
//
//   | Pair | Foreground | Background | Required | Ratio |
//   |---|---|---|---|---|
//   | light: body text on canvas | `#1C1B1A` | `#FAF9F6` | 4.5 | 16.52 |
//
// - Pair: free text name (spaces become underscores in the output).
// - Foreground, Background: a 6-digit hex colour (the first #RRGGBB in the cell is used).
// - Required: 4.5 (body text) or 3 (large text, UI components, focus ring).
// - Ratio: optional; when present it must equal the computed ratio rounded DOWN to 2 dp,
//   otherwise the pair is reported FAIL (stale table). --update rewrites it for you.
//
// Output, one line per pair:  PASS|FAIL name fg bg ratio required
// Exit code 1 if any pair fails or the file has no pairs. No dependencies.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const update = args.includes('--update');
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: node scripts/check-contrast.mjs <design-system.md> [--update]');
  process.exit(2);
}

const HEX = /#[0-9a-fA-F]{6}\b/;

function channel(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const floor2 = (x) => (Math.floor(x * 100 + 1e-9) / 100).toFixed(2);
const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

const lines = readFileSync(file, 'utf8').split('\n');
let cols = null;
let failed = false;
let pairs = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim().startsWith('|')) { cols = null; continue; }
  const cs = cells(line);
  const lower = cs.map((c) => c.toLowerCase());
  if (lower.includes('pair') && lower.includes('foreground') && lower.includes('background') && lower.includes('required')) {
    cols = {
      pair: lower.indexOf('pair'), fg: lower.indexOf('foreground'), bg: lower.indexOf('background'),
      req: lower.indexOf('required'), ratio: lower.indexOf('ratio'),
    };
    continue;
  }
  if (!cols || /^:?-{3,}/.test(cs[0] ?? '')) continue;
  const fg = (cs[cols.fg] ?? '').match(HEX)?.[0];
  const bg = (cs[cols.bg] ?? '').match(HEX)?.[0];
  const req = Number(cs[cols.req]);
  if (!fg || !bg || !(req === 3 || req === 4.5)) {
    console.log(`FAIL ${(cs[cols.pair] ?? '?').replace(/\s+/g, '_')} ${fg ?? '?'} ${bg ?? '?'} unparsable ${cs[cols.req] ?? '?'}`);
    failed = true; pairs++; continue;
  }
  const r = ratio(fg, bg);
  const shown = floor2(r);
  const stated = cols.ratio >= 0 ? cs[cols.ratio] : undefined;
  if (update && cols.ratio >= 0) {
    cs[cols.ratio] = shown;
    lines[i] = '| ' + cs.join(' | ') + ' |';
  }
  const stale = !update && stated !== undefined && stated !== '' && stated !== shown;
  const ok = r >= req && !stale;
  if (!ok) failed = true;
  pairs++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${cs[cols.pair].replace(/\s+/g, '_')} ${fg} ${bg} ${shown} ${req}${stale ? ` (table says ${stated})` : ''}`);
}

if (update) writeFileSync(file, lines.join('\n'));
if (pairs === 0) { console.error('FAIL no contrast pairs found'); process.exit(1); }
process.exit(failed ? 1 : 0);
