import { describe, expect, it } from "vitest";
import { addNames, disabledReason, splitNames, validateDraft } from "../../src/roomRules";

describe("room rules mirror the shared request schema", () => {
  it("splits pasted lists at commas and line breaks", () => {
    expect(splitNames("A, B\nC,, \n D")).toEqual(["A", "B", "C", "D"]);
  });

  it("adds, skips duplicates, over-long names and respects the limit of 6 crowd acts", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(addNames("crowd", [], [], "Apparat").added).toEqual(["Apparat"]);
    expect(addNames("crowd", ["Apparat"], [], "apparat").error).toBe("apparat is already in this list.");
    expect(addNames("crowd", [], [], "x".repeat(81)).error).toBe("Artist names are limited to 80 characters.");
    expect(addNames("crowd", six, [], "g").error).toBe("You can add up to 6 acts here. Remove one to add another.");
    expect(addNames("candidate", [], ["Apparat"], "Apparat").error).toBe("Apparat is already one of your crowd acts, so it cannot also be a candidate.");
    expect(addNames("crowd", [], [], "   ").error).toBe("Type an artist name first.");
    const pasted = addNames("crowd", ["a", "b", "c", "d"], [], "e, f, g");
    expect(pasted.added).toEqual(["e", "f"]);
    expect(pasted.skipped).toBe(1);
  });

  it("allows 12 candidates and stops at 13", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `act ${i}`);
    expect(addNames("candidate", twelve.slice(0, 11), [], "act 11").list).toHaveLength(12);
    expect(addNames("candidate", twelve, [], "extra").error).toContain("up to 12");
  });

  it("validates a draft with specific messages and names only what is missing", () => {
    expect(validateDraft({ city: "", crowd: ["a"], candidates: [] }).map((p) => p.field)).toEqual(["city-field", "crowd-input", "candidate-input"]);
    expect(validateDraft({ city: "Berlin", crowd: ["a", "b", "c"], candidates: ["x", "y", "z"] })).toEqual([]);
    expect(validateDraft({ city: "Berlin", crowd: ["a", "b", "c"], candidates: ["x", "y"] }).map((p) => p.message)).toEqual(["Add at least 3 candidate acts. You have 2."]);
    expect(disabledReason({ city: "Berlin", crowd: ["a", "b", "c"], candidates: ["x"] })).toBe("Add 2 more candidate acts to continue.");
    expect(disabledReason({ city: "", crowd: [], candidates: [] })).toBe("Add a city, at least 3 crowd acts and at least 3 candidate acts to continue.");
    expect(disabledReason({ city: "Berlin", crowd: ["a"], candidates: ["x"] })).toBe("Add 2 more crowd acts to continue.");
    expect(disabledReason({ city: "Berlin", crowd: ["a", "b", "c"], candidates: ["x", "y", "z"] })).toBeNull();
  });
});
