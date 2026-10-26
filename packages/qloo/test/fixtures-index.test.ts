import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = resolve(__dirname, "../../../fixtures/qloo");
const index = JSON.parse(readFileSync(join(DIR, "index.json"), "utf8")) as Record<string, string>;

describe("fixtures/qloo/index.json", () => {
  it("has entries", () => {
    expect(Object.keys(index).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(index))("%s resolves to an existing, well-formed fixture", (key, file) => {
    const path = join(DIR, file);
    expect(existsSync(path)).toBe(true);
    const fx = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    for (const k of ["endpoint", "params", "status", "recordedAt", "latencyMs", "body"]) {
      expect(fx).toHaveProperty(k);
    }
    const params = new URLSearchParams(
      Object.entries(fx.params as Record<string, string>).sort(([a], [b]) => (a < b ? -1 : 1)),
    );
    expect(key).toBe(`${String(fx.endpoint)}?${params.toString()}`);
  });

  it("indexes every fixture file", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
    expect(new Set(Object.values(index))).toEqual(new Set(files));
  });
});
