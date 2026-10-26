import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as core from "../src";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const files = readdirSync(SRC).filter((f) => f.endsWith(".ts"));
const read = (f: string): string => readFileSync(join(SRC, f), "utf8");

describe("packages/core boundary", () => {
  it("imports only zod and itself", () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const match of read(file).matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
        const spec = match[1] as string;
        if (spec !== "zod" && !spec.startsWith("./")) offenders.push(`${file}: ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no reference to fetch, process, fs, next, the Anthropic or OpenAI SDK, the clock or randomness", () => {
    const forbidden = /\bfetch\s*\(|\bprocess\.|\brequire\s*\(|["'](?:node:)?fs["']|["']next["']|@anthropic-ai|["']openai["']|Date\.now|new Date\(|Math\.random/;
    for (const file of files) expect(read(file), file).not.toMatch(forbidden);
  });

  it("has no prediction wording in any source string (forecast, turnout, will sell)", () => {
    for (const file of files) expect(read(file), file).not.toMatch(/forecast|turnout|will sell/i);
  });
});

describe("exports", () => {
  it("exposes the public functions the route and UI use", () => {
    for (const name of [
      "computeFit",
      "fitForCandidate",
      "computeStanding",
      "computeCityStrength",
      "buildCaveats",
      "rankActs",
      "assertEveryNumberHasEvidence",
      "isUnitInterval",
      "unavailable",
      "roundTo",
      "compareStrings",
    ]) {
      expect(typeof (core as Record<string, unknown>)[name], name).toBe("function");
    }
  });

  it("num helpers", () => {
    expect(core.unavailable("x")).toEqual({ status: "unavailable", reason: "x" });
    expect(core.roundTo(-0.04, 1)).toBe(0);
    expect(core.roundTo(-2.25, 1)).toBe(-2.3);
    expect(core.roundTo(2.25, 1)).toBe(2.3);
    expect(core.compareStrings("a", "b")).toBe(-1);
    expect(core.compareStrings("b", "a")).toBe(1);
    expect(core.compareStrings("a", "a")).toBe(0);
    expect(core.isUnitInterval(0)).toBe(true);
    expect(core.isUnitInterval(1.01)).toBe(false);
  });
});
