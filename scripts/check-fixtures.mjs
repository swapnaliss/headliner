// Fixture hygiene (called by scripts/landing-checks.sh): every Qloo fixture parses, has the wrapper shape,
// carries no key/header material, and index.json resolves. Prints file names only, never content.
/* global console, process */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "fixtures/qloo";
const REQUIRED = ["endpoint", "params", "status", "recordedAt", "latencyMs", "body"];
let bad = 0;
const fail = (m) => {
  console.error(`check-fixtures: ${m}`);
  bad += 1;
};

const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
for (const f of files) {
  const text = readFileSync(join(DIR, f), "utf8");
  if (/x-api-key/i.test(text)) fail(`${f} mentions the API-key header`);
  try {
    const fx = JSON.parse(text);
    for (const k of REQUIRED) if (!(k in fx)) fail(`${f} missing ${k}`);
  } catch {
    fail(`${f} is not valid JSON`);
  }
}
const index = JSON.parse(readFileSync(join(DIR, "index.json"), "utf8"));
for (const f of Object.values(index)) if (!files.includes(f)) fail(`index.json points at missing ${f}`);
if (bad) process.exit(1);
console.log(`check-fixtures: ok (${files.length} fixtures)`);
