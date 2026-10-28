#!/usr/bin/env node
// Docs check (M4-01): README.md and docs/architecture.md.
//   1. every relative link and image resolves to a tracked file (git ls-files),
//   2. no forbidden wording outside the banner or a negation,
//   3. every number in the README appears in an evidence file, an ADR or the code that sets the limit.
// Run: node scripts/check-readme.mjs   (prints the number -> source mapping with --map)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const FILES = ["README.md", "docs/architecture.md"];
const tracked = new Set(execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean));
const failures = [];

// 1. links and images
for (const file of FILES) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = normalize(join(dirname(file), target.split("#")[0]));
    if (!existsSync(path) || !(tracked.has(path) || [...tracked].some((t) => t.startsWith(path + "/")))) failures.push(`${file}: broken or untracked link ${target}`);
  }
  // alt text on every image
  for (const m of text.matchAll(/!\[([^\]]*)\]\(/g)) if (!m[1]?.trim()) failures.push(`${file}: image without alt text`);
}

// 2. forbidden wording (README): allowed only in the banner line or in a negation
const readme = readFileSync("README.md", "utf8");
readme.split("\n").forEach((line, i) => {
  if (!/will sell|turnout|forecast/i.test(line)) return;
  const ok = /aggregate affinity, not a ticket forecast/i.test(line) || /\b(not|no|nothing|never|without)\b[^.]*\b(forecast|turnout)/i.test(line) || /does not forecast/i.test(line);
  if (!ok) failures.push(`README.md:${i + 1}: forbidden wording outside banner or negation: ${line.trim()}`);
});
for (const f of ["README.md", "docs/architecture.md"]) {
  const t = readFileSync(f, "utf8");
  if (/X-Api-Key\s*[:=]\s*\S{8,}|sk-[A-Za-z0-9]{16,}/.test(t)) failures.push(`${f}: key-shaped string`);
}

// 3. numbers
const sources = new Map();
const add = (p) => sources.set(p, readFileSync(p, "utf8"));
for (const f of readdirSync("docs/evidence")) if (f.endsWith(".md")) add(join("docs/evidence", f));
for (const f of readdirSync("docs/adr")) add(join("docs/adr", f));
for (const p of ["docs/architecture.md", "packages/budgets/src/config.ts", "packages/core/src/request.ts", "fixtures/qloo/README.md", "apps/web/samples/rooms.json"]) add(p);
const body = readme.replace(/```[\s\S]*?```/g, " ").replace(/\]\([^)]*\)/g, "] ").replace(/<https?:[^>]*>/g, " ").replace(/`[^`]*`/g, (c) => c);
const map = [];
const seen = new Set();
// Plain counts of things the page itself lists (steps, headings, list positions) are not claims.
const NOT_CLAIMS = new Set(["1", "2", "3", "4", "5", "6"]);
for (const m of body.matchAll(/(?<![\w./-])-?\d+(?:,\d{3})*(?:\.\d+)?(?![\w-]*\.(?:png|md))/g)) {
  const raw = m[0];
  if (seen.has(raw) || NOT_CLAIMS.has(raw)) continue;
  seen.add(raw);
  const variants = [raw, raw.replace(/,/g, ""), raw.replace(/^-/, "")];
  const hit = [...sources].filter(([, t]) => variants.some((v) => new RegExp(`(?<![\\d.])${v.replace(/[.]/g, "\\.")}(?![\\d])`).test(t))).map(([p]) => p);
  if (hit.length === 0) failures.push(`README.md: number ${raw} not found in any evidence file, ADR or limit source`);
  else map.push(`${raw}\t${hit.slice(0, 2).join(", ")}`);
}

// Specific claims: each figure must appear in the evidence file the README cites for it.
const CLAIMS = [
  ["docs/evidence/home-city-check.md", ["**12 of 15**", "Acts listed: 15", "Cities in the set: 5", "continents: 3", "BTS", "BLACKPINK", "IU"]],
  ["docs/evidence/fit-sanity.md", ["**11 of 12**", "electronic: 4 of 4", "jazz: 3 of 4", "hip-hop: 4 of 4", "-0.2", "+4.0", "+1.3", "+0.4", "+0.8"]],
  ["docs/evidence/agent-evals.md", ["**106**", "**1391**", "39 intake traces", "3 explanation replies"]],
  ["docs/evidence/qloo-latency.md", ["| `/search` | 16 | 314 | 335 | 1634 |", "| `/v2/insights/compare` | 5 | 355 | 388 | 1631 |", "| `/v2/insights` heatmap | 10 | 507 | 704 | 1989 |", "| `/v2/insights` (artists, take 10) | 3 | 3309 | 3420 | 4952 |"]],
  ["docs/evidence/qloo-cold-slate.md", ["4,988 ms", "5,555 ms", "9 of 39"]],
  ["docs/evidence/m3-gate.md", ["**3.89 s**", "844 tokens", "0.0000674 USD", "**0.47 s**"]],
  ["docs/evidence/m2-gate.md", ["1.72 s"]],
];
for (const [file, needles] of CLAIMS) {
  const t = readFileSync(file, "utf8");
  for (const n of needles) if (!t.includes(n)) failures.push(`${file}: expected text not found: ${n}`);
}
if (process.argv.includes("--map")) console.log(map.join("\n"));
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`check-readme: ok (${FILES.length} files, ${map.length} distinct numbers sourced)`);
