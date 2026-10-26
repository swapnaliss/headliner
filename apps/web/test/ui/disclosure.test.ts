import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

describe("disclosure markers (BL-01 sweep M1)", () => {
  it.each(["banner-details", "disclosure", "evidence"])("%s summary has a closed and an open marker", (cls) => {
    expect(css).toMatch(new RegExp(`\\.${cls} > summary::before[\\s\\S]*?content: "\\\\25B8"`));
    expect(css).toMatch(new RegExp(`\\.${cls}\\[open\\] > summary::before[\\s\\S]*?content: "\\\\25BE"`));
  });
});
