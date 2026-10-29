import { CAVEAT_WORDING } from "@headliner/core";
import { describe, expect, it } from "vitest";
import { mergeThinMessages } from "../src/thinData";
import { mergeThinData } from "../src/ui/CaveatChip";

const ONE = CAVEAT_WORDING["thin-data"];
const MANY = "Fewer than 15 Qloo heatmap cells back these cities, so their strength is thin data.";

describe("mergeThinMessages (one sentence per card)", () => {
  it("keeps the singular sentence for one city", () => {
    expect(mergeThinMessages([ONE])).toBe("Fewer than 15 Qloo heatmap cells back this city, so its strength is thin data.");
  });
  it("says 'these cities' once for two thin cities", () => {
    expect(mergeThinMessages([ONE, ONE])).toBe(MANY);
  });
  it("says 'these cities' once for three thin cities", () => {
    expect(mergeThinMessages([ONE, ONE, ONE])).toBe(MANY);
  });
  it("keeps genuinely different sentences, de-duplicated, in order", () => {
    expect(mergeThinMessages(["A.", "B.", "A."])).toBe("A. B.");
  });
});

describe("mergeThinData with the real core sentence", () => {
  const caveat = (subject: string) => ({ type: "thin-data" as const, subject, message: ONE });
  it.each([
    [["Berlin"], "Berlin", ONE],
    [["Berlin", "Leipzig"], "Berlin, Leipzig", MANY],
    [["Berlin", "Leipzig", "London"], "Berlin, Leipzig, London", MANY],
  ])("%j gives one chip and one sentence", (cities, subject, sentence) => {
    const merged = mergeThinData(cities.map(caveat));
    expect(merged).toHaveLength(1);
    expect(merged[0]?.subject).toBe(subject);
    expect(merged[0]?.message).toBe(sentence);
    expect((merged[0]?.message.match(/Fewer than/g) ?? []).length).toBe(1);
  });
});
