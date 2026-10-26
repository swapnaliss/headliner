import { describe, expect, it } from "vitest";
import { demoMode, loadEnv } from "../src/env";

describe("env", () => {
  it("needs nothing in fixtures mode", () => {
    expect(loadEnv({ DEMO_MODE: "fixtures" })).toEqual({ mode: "fixtures" });
  });
  it("treats DATABASE_URL as optional in fixtures mode", () => {
    expect(loadEnv({ DEMO_MODE: "fixtures", DATABASE_URL: "d" })).toEqual({ mode: "fixtures", databaseUrl: "d" });
  });
  it("defaults to fixtures when DEMO_MODE is absent or unknown", () => {
    expect(demoMode({})).toBe("fixtures");
    expect(demoMode({ DEMO_MODE: "weird" })).toBe("fixtures");
  });
  it("requires keys in live mode", () => {
    expect(() => loadEnv({ DEMO_MODE: "live" })).toThrow();
    const env = loadEnv({ DEMO_MODE: "live", QLOO_API_KEY: "k", DATABASE_URL: "d" });
    expect(env.mode).toBe("live");
  });
});
