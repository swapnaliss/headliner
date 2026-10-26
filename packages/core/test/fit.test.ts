import { describe, expect, it } from "vitest";
import { FIT_MIN_SHARED_TAGS, computeFit, fitForCandidate } from "../src";
import { compareTags, okFit, tag, tags } from "./helpers";

const KHRUANGBIN = "compare--list6-crowd-vs-khruangbin.json";
const RADIOHEAD = "compare--list6-crowd-vs-radiohead.json";
const REALITY_CLUB = "compare--list6-crowd-vs-reality-club.json";

/** Deterministic Fisher-Yates with a fixed LCG so permutations are reproducible. */
function permute<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

describe("computeFit", () => {
  it("is the mean of shared-tag scores x 100, one decimal", () => {
    expect(okFit(computeFit([tag("a", 0.5), tag("b", 0.6), tag("c", 0.7)]))).toBe(60);
    expect(okFit(computeFit([tag("a", 0.5), tag("b", 0.5), tag("c", 0.51)]))).toBe(50.3);
  });

  it("edge empty tag list: unavailable, never zero", () => {
    expect(computeFit([])).toEqual({ status: "unavailable", reason: "no-shared-tags" });
    expect(computeFit(null)).toEqual({ status: "unavailable", reason: "no-shared-tags" });
    expect(computeFit(undefined).status).toBe("unavailable");
  });

  it("edge single tag: below the minimum and reports how many", () => {
    expect(FIT_MIN_SHARED_TAGS).toBe(3);
    expect(computeFit([tag("a", 0.9)])).toEqual({ status: "unavailable", reason: "too-few-shared-tags", sharedTags: 1 });
    expect(computeFit([tag("a", 0.9), tag("b", 0.9)])).toMatchObject({ reason: "too-few-shared-tags", sharedTags: 2 });
    expect(computeFit([tag("a", 0.9), tag("b", 0.9), tag("c", 0.9)]).status).toBe("ok");
  });

  it("edge non-finite or out-of-range scores: dropped and counted", () => {
    const result = computeFit([
      ...tags(3, 0.6),
      tag("nan", Number.NaN),
      tag("inf", Number.POSITIVE_INFINITY),
      tag("neg", -0.1),
      tag("big", 1.2),
    ]);
    expect(result).toMatchObject({ status: "ok", fit: 60, sharedTags: 3, droppedTags: 4 });
  });

  it("edge blank or missing tag_id and malformed entries: dropped and counted", () => {
    const malformed = [{ tag_id: "", query: { score: 0.5 } }, {}, null] as unknown as Parameters<typeof computeFit>[0];
    const result = computeFit([...tags(3, 0.6), ...(malformed ?? [])]);
    expect(result).toMatchObject({ status: "ok", droppedTags: 3 });
  });

  it("edge only unusable scores: unavailable", () => {
    expect(computeFit([tag("a", Number.NaN), tag("b", 2), tag("c", -1)])).toEqual({
      status: "unavailable",
      reason: "no-shared-tags",
    });
  });

  it("edge score bounds: 0 and 1 are valid", () => {
    expect(okFit(computeFit([tag("a", 0), tag("b", 0), tag("c", 0)]))).toBe(0);
    expect(okFit(computeFit([tag("a", 1), tag("b", 1), tag("c", 1)]))).toBe(100);
  });

  it("edge ties: repeats with equal coverage use the higher score", () => {
    const result = computeFit([tag("g", 0.5, ["A"]), tag("g", 0.8, ["B"]), tag("h", 0.5), tag("i", 0.5)]);
    expect(okFit(result)).toBe(60);
  });

  it("edge ties: identical score and coverage choose the name deterministically", () => {
    const named = (name: string) => ({ ...tag("g", 0.5), name });
    const a = computeFit([named("Zed"), named("Alpha"), tag("h", 0.5), tag("i", 0.5)]);
    const b = computeFit([named("Alpha"), named("Zed"), tag("h", 0.5), tag("i", 0.5)]);
    expect(a).toEqual(b);
    expect(a.status === "ok" && a.overlapTags.find((t) => t.tagId === "g")?.name).toBe("Alpha");
  });

  it("de-duplicates repeated tag ids using the repeat that covers the most crowd acts", () => {
    const result = computeFit([
      tag("g", 0.9, ["A"]),
      tag("g", 0.5, ["A", "B", "C"]),
      tag("h", 0.6, ["A", "A"]),
      tag("i", 0.7, ["A"]),
    ]);
    expect(result).toMatchObject({ status: "ok", fit: 60, sharedTags: 3, droppedTags: 0 });
  });

  it("returns overlap tags strongest first and echoes the caller's evidence refs", () => {
    const result = computeFit(
      [
        { ...tag("b", 0.7), name: "Beta" },
        { ...tag("a", 0.9), name: "Alpha" },
        tag("c", 0.7),
      ],
      ["ev-1"],
    );
    expect(result).toMatchObject({
      status: "ok",
      evidenceRefs: ["ev-1"],
      overlapTags: [
        { tagId: "a", name: "Alpha", score: 0.9 },
        { tagId: "b", name: "Beta", score: 0.7 },
        { tagId: "c", name: "c", score: 0.7 },
      ],
    });
  });

  it("property: deterministic and order-independent for permuted tag lists", () => {
    for (const file of [KHRUANGBIN, RADIOHEAD, REALITY_CLUB]) {
      const original = compareTags(file);
      const expected = computeFit(original, ["e"]);
      expect(computeFit(original, ["e"])).toEqual(expected);
      for (let seed = 1; seed <= 25; seed += 1) {
        expect(computeFit(permute(original, seed), ["e"])).toEqual(expected);
      }
    }
    const synthetic = [tag("a", 0.51), tag("b", 0.62), tag("c", 0.73), tag("d", 0.84), tag("a", 0.9, ["A", "B"])];
    for (let seed = 1; seed <= 25; seed += 1) expect(computeFit(permute(synthetic, seed))).toEqual(computeFit(synthetic));
  });

  it("recorded compares match the values in ADR 0013", () => {
    const expected: [string, number, number][] = [
      [REALITY_CLUB, 60.6, 71],
      [RADIOHEAD, 59.5, 86],
      [KHRUANGBIN, 58.1, 46],
    ];
    for (const [file, fit, shared] of expected) {
      expect(computeFit(compareTags(file))).toMatchObject({ status: "ok", fit, sharedTags: shared, droppedTags: 0 });
    }
  });
});

describe("fitForCandidate", () => {
  const crowd = ["AAA-1", "BBB-2"];
  it("edge unresolved entity: unavailable, never a zero", () => {
    expect(fitForCandidate({ candidateId: null, crowdIds: crowd, tags: tags(5) })).toEqual({
      status: "unavailable",
      reason: "unresolved-entity",
    });
    expect(fitForCandidate({ candidateId: "", crowdIds: crowd, tags: tags(5) }).status).toBe("unavailable");
    expect(fitForCandidate({ candidateId: "CCC-3", crowdIds: crowd, tags: null })).toMatchObject({
      reason: "unresolved-entity",
    });
  });
  it("edge candidate equal to a crowd act: unavailable, ignoring id case", () => {
    expect(fitForCandidate({ candidateId: "aaa-1", crowdIds: crowd, tags: tags(5) })).toEqual({
      status: "unavailable",
      reason: "candidate-in-crowd",
    });
  });
  it("scores a resolved, distinct candidate and passes evidence refs through", () => {
    const result = fitForCandidate({ candidateId: "CCC-3", crowdIds: crowd, tags: tags(5, 0.7), evidenceRefs: ["x"] });
    expect(okFit(result)).toBe(70);
    expect(result.status === "ok" && result.evidenceRefs).toEqual(["x"]);
    expect(okFit(fitForCandidate({ candidateId: "CCC-3", crowdIds: crowd, tags: tags(5, 0.7) }))).toBe(70);
  });
});
