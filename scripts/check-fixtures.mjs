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

// fixtures/qloo (M0-02, M2) and fixtures/qloo/proof (M3-04, with its own index.json and a run-log.json that is not a fixture).
let total = 0;
for (const dir of [DIR, join(DIR, "proof")]) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json" && f !== "run-log.json");
  total += files.length;
  for (const f of files) {
    const text = readFileSync(join(dir, f), "utf8");
    if (/x-api-key/i.test(text)) fail(`${f} mentions the API-key header`);
    try {
      const fx = JSON.parse(text);
      for (const k of REQUIRED) if (!(k in fx)) fail(`${f} missing ${k}`);
    } catch {
      fail(`${f} is not valid JSON`);
    }
  }
  const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
  for (const f of Object.values(index)) if (!files.includes(f)) fail(`${dir}/index.json points at missing ${f}`);
}
if (bad) process.exit(1);
console.log(`check-fixtures: ok (${total} fixtures)`);
