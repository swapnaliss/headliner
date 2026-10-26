import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyMatch, MATCH_CONFIDENCE, normaliseMatchName, type SearchHit } from "./index";

interface RecordedHit {
  entity_id: string;
  name: string;
  popularity: number;
  disambiguation?: string;
  tags: { name: string }[];
}

/** The hits of a recorded Qloo /search response, in Qloo's order. */
function recorded(file: string): SearchHit[] {
  const path = resolve(__dirname, "../../../fixtures/qloo", file);
  const body = JSON.parse(readFileSync(path, "utf8")) as { body: { results: RecordedHit[] } };
  return body.body.results.map((r) => ({ entityId: r.entity_id, name: r.name, popularity: r.popularity, disambiguation: r.disambiguation ?? null, tags: r.tags }));
}

describe("classifyMatch over recorded searches", () => {
  it("exact: the top hit is the only one named like the query", () => {
    for (const [query, file] of [
      ["Apparat", "search--apparat.json"],
      ["Khruangbin", "search--khruangbin.json"],
      ["Reality Club", "search--reality-club.json"],
      ["Boys Noize", "search--boys-noize.json"],
      ["Phoenix", "search--phoenix.json"],
    ] as const) {
      const state = classifyMatch(query, recorded(file));
      expect(state.state, query).toBe("exact");
      expect(state.candidates).toHaveLength(1);
    }
  });

  it("exact carries id, name, popularity and at most 3 distinct tags", () => {
    const state = classifyMatch("Phoenix", recorded("search--phoenix.json"));
    const only = state.candidates[0];
    expect(only?.entityId).toBe("E7649B3E-6FFE-46A1-85F3-836D842B2AF0");
    expect(only?.name).toBe("Phoenix");
    expect(only?.popularity).toBeCloseTo(0.9995, 3);
    expect(only?.tags).toEqual(["Indie Pop", "Indie", "Electronic"]);
  });

  it("none: an empty result", () => {
    expect(classifyMatch("Zzqxv Nonexistentact 9731", recorded("search--zzqxv-nonexistentact-9731.json"))).toEqual({ state: "none", candidates: [] });
    expect(classifyMatch("anything", [])).toEqual({ state: "none", candidates: [] });
  });

  it("ambiguous: the top hit is named differently from the query (accent difference)", () => {
    const state = classifyMatch("Bjork", recorded("search--bjork.json"));
    expect(state.state).toBe("ambiguous");
    expect(state.candidates.length).toBeLessThanOrEqual(5);
    expect(state.candidates[0]?.name).toBe("Björk");
    const sigur = classifyMatch("Sigur Ros", recorded("search--sigur-ros.json"));
    expect(sigur.state).toBe("ambiguous");
    expect(sigur.candidates[0]?.name).toBe("Sigur Rós");
  });

  it("ambiguous: a misspelling whose hits are all differently named", () => {
    expect(classifyMatch("Radiohed", recorded("search--radiohead.json")).state).toBe("ambiguous");
  });

  it("ambiguous: two distinct entities with the same name", () => {
    const phoenix = recorded("search--phoenix.json");
    const twin: SearchHit = { ...(phoenix[0] as SearchHit), entityId: "AAAAAAAA-0000-4000-8000-000000000002", disambiguation: "Australian singer" };
    const state = classifyMatch("Phoenix", [phoenix[0] as SearchHit, twin, ...phoenix.slice(1)]);
    expect(state.state).toBe("ambiguous");
    expect(state.candidates.map((c) => c.disambiguation)).toContain("Australian singer");
  });

  it("ambiguous: the same-named hit is not first", () => {
    const hits = recorded("search--odunsi-the-engine.json");
    expect(classifyMatch("Odunsi (The Engine)", hits).state).toBe("exact");
    const swapped = [hits[1] as SearchHit, hits[0] as SearchHit, ...hits.slice(2)];
    expect(classifyMatch("Odunsi (The Engine)", swapped).state).toBe("ambiguous");
  });

  it("returns at most 5 candidates and lists a repeated entity id once", () => {
    const hits = recorded("search--moderat.json");
    const many = [...hits, ...hits, { ...(hits[1] as SearchHit), entityId: "BBBBBBBB-0000-4000-8000-000000000001" }];
    const state = classifyMatch("Moder", many);
    expect(state.state).toBe("ambiguous");
    expect(state.candidates).toHaveLength(5);
    expect(new Set(state.candidates.map((c) => c.entityId.toUpperCase())).size).toBe(5);
  });

  it("an entity that differs only by id case is not listed twice", () => {
    const hit = recorded("search--hindia.json")[0] as SearchHit;
    const state = classifyMatch("Hindia", [hit, { ...hit, entityId: hit.entityId.toLowerCase() }]);
    expect(state.state).toBe("exact");
  });
});

describe("normalisation: unicode, whitespace and case", () => {
  it("case-folds, trims and collapses whitespace", () => {
    expect(normaliseMatchName("  Brandt   Brauer\tFrick ")).toBe("brandt brauer frick");
    expect(normaliseMatchName("APPARAT")).toBe("apparat");
  });

  it("applies NFKC so composed and decomposed accents are equal, while keeping accents", () => {
    expect(normaliseMatchName("Björk")).toBe(normaliseMatchName("Björk"));
    expect(normaliseMatchName("Bjork")).not.toBe(normaliseMatchName("Björk"));
    expect(normaliseMatchName("Ａpparat")).toBe("apparat");
    expect(normaliseMatchName("Straße")).toBe("strasse");
  });

  it("classifies variants of a recorded name as exact", () => {
    const apparat = recorded("search--apparat.json");
    for (const q of ["apparat", "  APPARAT  ", "Apparat "]) expect(classifyMatch(q, apparat).state, q).toBe("exact");
    const bjork = recorded("search--bjork.json");
    for (const q of ["Björk", "BJÖRK", "Björk", " björk "]) expect(classifyMatch(q, bjork).state, q).toBe("exact");
    expect(classifyMatch("amaarae", recorded("search--amaarae.json")).state).toBe("exact");
  });
});

describe("match confidence model (provisional, owned by M2-01)", () => {
  it("an exact match is 1 and a user choice is lower", () => {
    expect(MATCH_CONFIDENCE.exact).toBe(1);
    expect(MATCH_CONFIDENCE.chosenByUser).toBeLessThan(MATCH_CONFIDENCE.exact);
  });
});
