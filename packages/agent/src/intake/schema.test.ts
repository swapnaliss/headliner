import { describe, expect, it } from "vitest";
import { findUngrounded } from "./guardrails";
import { IntakeResultSchema, SubmitRoomSchema } from "./schema";

const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `Act ${i}`);

describe("limits (documented caps: 6 crowd, 12 candidates, 5 cities, 80-char names)", () => {
  it("accepts the caps exactly", () => {
    const r = SubmitRoomSchema.safeParse({ city: "x".repeat(80), crowdActs: names(6), candidateActs: names(12), cities: names(5) });
    expect(r.success).toBe(true);
  });
  it.each([
    ["7 crowd acts", { crowdActs: names(7) }],
    ["13 candidates", { candidateActs: names(13) }],
    ["6 cities", { cities: names(6) }],
    ["an 81-char name", { crowdActs: ["x".repeat(81)] }],
    ["an empty name", { crowdActs: [" "] }],
    ["a control character", { crowdActs: ["A\u0000B"] }],
    ["a zero-width or soft-hyphen character", { crowdActs: ["Moder­at"] }],
    ["an unknown key", { extra: 1 }],
  ])("rejects %s", (_l, patch) => {
    expect(SubmitRoomSchema.safeParse({ city: "Leipzig", crowdActs: [], candidateActs: [], cities: [], ...patch }).success).toBe(false);
  });
});

describe("IntakeResultSchema", () => {
  it("requires a city unless a question is asked, and bounds steps to 3", () => {
    const room = { city: "", crowdActs: [], candidateActs: [] };
    expect(IntakeResultSchema.safeParse({ room, cities: [], steps: 1 }).success).toBe(false);
    expect(IntakeResultSchema.safeParse({ room, cities: [], steps: 1, clarification: "Which city?" }).success).toBe(true);
    expect(IntakeResultSchema.safeParse({ room: { ...room, city: "Leipzig" }, cities: [], steps: 4 }).success).toBe(false);
  });
});

describe("findUngrounded", () => {
  const sentence = "Venue in Tromsø, crowd loves Sigur Rós";
  it("ignores case, accents and spacing", () => {
    expect(findUngrounded(sentence, { city: "tromso", crowdActs: ["Sigur  Ros"], candidateActs: [], cities: [] })).toEqual([]);
  });
  it("returns paths of names that are not in the sentence, never their text", () => {
    expect(findUngrounded(sentence, { city: "Tromsø", crowdActs: ["Sigur Rós", "Invented"], candidateActs: ["Other"], cities: ["Paris"] })).toEqual([
      "crowdActs.1",
      "candidateActs.0",
      "cities.0",
    ]);
  });
});
