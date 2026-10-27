// M3-04 proof tests (replay only: offline, no key, no network). They check that the committed evidence is
// exactly what the recorded fixtures produce, that the pre-registered sets were not edited after the results,
// and that the documented rule is applied as written. They do not require any particular outcome: a miss is
// reported in docs/evidence/fit-sanity.md, not hidden by a test that would fail on it.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVIDENCE_DIR, FIXTURE_DIR, loadRunLog, loadSets, replayClient } from "./common";
import { runProof, type ProofOutput } from "./run";

const read = (p: string): string => readFileSync(p, "utf8");
const HOME = join(EVIDENCE_DIR, "home-city-check.md");
const FIT = join(EVIDENCE_DIR, "fit-sanity.md");

let out: ProofOutput;
const sets = loadSets();

describe("M3-04 proof (replay from fixtures/qloo/proof)", () => {
  it("runs offline and reproduces both committed tables byte for byte", async () => {
    out = await runProof(replayClient(), sets, loadRunLog());
    expect(out.markdown.homeCity).toBe(read(HOME));
    expect(out.markdown.fitSanity).toBe(read(FIT));
  });

  it("fails when a set file is edited without regenerating the evidence (digest recorded in the report)", () => {
    expect(read(HOME)).toContain(`sha256 \`${sets.homeCityDigest}\``);
    expect(read(FIT)).toContain(`sha256 \`${sets.fitDigest}\``);
  });

  it("the home-city set meets its stated shape: at least 12 acts, 4 cities, 2 continents, a source per act", () => {
    const acts = sets.homeCity.acts;
    expect(acts.length).toBeGreaterThanOrEqual(12);
    expect(new Set(acts.map((a) => a.homeCity)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(acts.map((a) => a.continent)).size).toBeGreaterThanOrEqual(2);
    for (const a of acts) expect(a.source.length).toBeGreaterThan(10);
  });

  it("lists every act in the home-city table with a hit count as 'k of N' and no pass or fail line", () => {
    const text = read(HOME);
    for (const a of sets.homeCity.acts) expect(text).toContain(`| ${a.name} |`);
    expect(text).toMatch(/\*\*\d+ of \d+\*\* resolved acts/);
    expect(text.match(/target|threshold/gi) ?? []).toHaveLength(0);
  });

  it("applies the documented Fit rule: strictly higher than the control, unavailable never counted as a win", () => {
    expect(out.fitSanity.crowds.length).toBeGreaterThanOrEqual(3);
    for (const crowd of out.fitSanity.crowds) {
      expect(crowd.candidates.length).toBeGreaterThanOrEqual(3);
      for (const c of crowd.candidates) {
        const expected = c.fit !== null && crowd.control.fit !== null ? c.fit > crowd.control.fit : null;
        expect(c.outranksControl).toBe(expected);
      }
      expect(crowd.outranking).toBe(crowd.candidates.filter((c) => c.outranksControl === true).length);
    }
    const s = out.fitSanity.summary;
    expect(read(FIT)).toContain(`**${s.outranking} of ${s.comparable}**`);
  });

  it("shows misses in the report: one 'no' row per same-genre candidate that did not outrank its control", () => {
    const misses = out.fitSanity.summary.comparable - out.fitSanity.summary.outranking;
    const noRows = read(FIT)
      .split("\n")
      .filter((l) => l.startsWith("|") && l.includes("| same-genre |") && /\| no \|$/.test(l));
    expect(noRows).toHaveLength(misses);
  });

  it("holds no key or header material in the fixtures or the reports", () => {
    const files = [...readdirSync(FIXTURE_DIR).map((f) => join(FIXTURE_DIR, f)), HOME, FIT];
    for (const f of files) expect(read(f).toLowerCase()).not.toContain("x-api-key");
    const key = process.env["QLOO_API_KEY"];
    if (key) for (const f of files) expect(read(f)).not.toContain(key);
  });

  it("has a run log with the live call count and latency", () => {
    const log = loadRunLog();
    expect(log.liveCalls).toBeGreaterThan(0);
    expect(log.byEndpoint.length).toBeGreaterThan(0);
    expect(read(HOME)).toContain(`Live calls: ${log.liveCalls}`);
  });
});
