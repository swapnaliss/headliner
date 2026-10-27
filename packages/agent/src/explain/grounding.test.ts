import { describe, expect, it } from "vitest";
import { groundingCheck } from "./grounding";
import { loadReply, loadSlate, withActName } from "./testkit";

const slate = loadSlate("sample-leipzig-indie");
// The Slate has Moderat at Fit 63.8, so 91 and 95% are invented.

function violations(text: string): string[] {
  const r = groundingCheck(text, slate);
  return r.ok ? [] : r.violations.map((v) => `${v.kind}:${v.token}`);
}

describe("groundingCheck", () => {
  it("fails on an invented number (Fit 91 when the Slate has 63.8)", () => {
    expect(violations("Moderat has an audience-taste fit of 91 out of 100.")).toEqual(["number:91"]);
  });

  it("fails on a percentage that is not in the Slate", () => {
    expect(violations("Its audience overlaps the crowd by 95%.")).toEqual(["number:95"]);
  });

  it("fails on a figure spelled as words that the Slate does not show", () => {
    expect(violations("Moderat has a fit of ninety one.")).toEqual(["number:ninety one"]);
    expect(violations("It is twice as close.")).toEqual(["number:twice"]);
  });

  it("fails on rounding a Slate figure (63.8 written as 64)", () => {
    expect(violations("A fit of 64.")).toEqual(["number:64"]);
  });

  it.each([
    ["forecast", "This is a forecast for the night."],
    ["turnout", "Expect a strong turnout."],
    ["will sell", "Moderat will sell well."],
    ["ticket sales", "Ticket sales should follow."],
    ["momentum", "Moderat has momentum."],
    ["trend", "The act is trending upward."],
  ])("fails on the banned word: %s", (_label, text) => {
    const found = violations(text);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((v) => v.startsWith("banned:"))).toBe(true);
  });

  it("fails on HTML, markdown and links", () => {
    expect(violations("<script>alert(1)</script>").some((v) => v.startsWith("markup:"))).toBe(true);
    expect(violations("See [here](http://example.com).").some((v) => v.startsWith("markup:"))).toBe(true);
    expect(violations("**Moderat** ranks first.").some((v) => v.startsWith("markup:"))).toBe(true);
  });

  it("passes on Slate figures, copied exactly, and on number words for Slate figures", () => {
    expect(groundingCheck("Moderat ranks 1 with a fit of 63.8 from 67 shared tags, a median of 100.0, 99.7 of 100.", slate)).toEqual({ ok: true });
    expect(groundingCheck("All five acts could be scored.", slate)).toEqual({ ok: true });
  });

  it("passes on the recorded grounded reply and fails on the recorded ungrounded one", () => {
    const grounded = (JSON.parse(loadReply("grounded")) as { sentences: string[] }).sentences.join("\n");
    const ungrounded = (JSON.parse(loadReply("ungrounded")) as { sentences: string[] }).sentences.join("\n");
    expect(groundingCheck(grounded, slate)).toEqual({ ok: true });
    expect(violations(ungrounded)).toEqual(["number:91", "number:95"]);
  });

  it("does not read digits inside an entity name as a figure", () => {
    const named = withActName(slate, 0, "Blink-182");
    expect(groundingCheck("Blink-182 ranks 1 with a fit of 63.8.", named)).toEqual({ ok: true });
    // ...but the same digits outside the name are still a number.
    const outside = groundingCheck("Blink-182 ranks 1 with a fit of 182.", named);
    expect(outside).toEqual({ ok: false, violations: [{ kind: "number", token: "182" }] });
  });

  it("does not trip on a banned word that is part of an entity name", () => {
    const named = withActName(slate, 0, "Turnout Kids");
    expect(groundingCheck("Turnout Kids ranks 1 with a fit of 63.8.", named)).toEqual({ ok: true });
  });
});
