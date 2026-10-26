import { describe, expect, it } from "vitest";
import { version } from "../src/index";

describe("@headliner/agent", () => {
  it("exports a version", () => {
    expect(version).toBe("0.1.0");
  });
});
