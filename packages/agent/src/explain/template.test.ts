import { CAVEAT_WORDING } from "@headliner/core";
import { describe, expect, it } from "vitest";
import { buildFacts, buildSlateFacts, type Fact } from "./facts";
import { allowedNumbers, groundingCheck } from "./grounding";
import { renderTemplate } from "./template";
import { buildUserPrompt } from "./prompt";
import { loadSlate } from "./testkit";

const leipzig = loadSlate("sample-leipzig-indie");
const berlin = loadSlate("sample-berlin-electronic");

describe("renderTemplate", () => {
  it("is byte-stable on the recorded Leipzig slate (snapshot)", () => {
    expect(renderTemplate(buildSlateFacts(leipzig))).toMatchSnapshot();
  });

  it("is byte-stable for one act with city strengths (Berlin, snapshot)", () => {
    const first = berlin.results[0]!;
    expect(renderTemplate(buildSlateFacts(berlin, { actId: first.act.qlooEntityId }))).toMatchSnapshot();
  });

  it("is deterministic: the same facts always give the same text", () => {
    const facts = buildSlateFacts(leipzig);
    expect(renderTemplate(facts)).toBe(renderTemplate(structuredClone(facts)));
  });

  it("contains only numbers present in the Slate", () => {
    for (const slate of [leipzig, berlin]) {
      const text = renderTemplate(buildSlateFacts(slate));
      expect(groundingCheck(text, slate)).toEqual({ ok: true });
      const allowed = allowedNumbers(slate);
      for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) expect(allowed.has(String(Number(m[0])))).toBe(true);
    }
  });

  it("passes the grounding check for every act's own explanation", () => {
    for (const slate of [leipzig, berlin]) {
      for (const r of slate.results) {
        expect(groundingCheck(renderTemplate(buildSlateFacts(slate, { actId: r.act.qlooEntityId })), slate)).toEqual({ ok: true });
      }
    }
  });

  it("says audience-taste fit and Qloo popularity rank, and uses none of the banned wording", () => {
    const text = renderTemplate(buildSlateFacts(leipzig));
    expect(text).toContain("audience-taste fit");
    expect(text).toContain("Qloo popularity rank");
    expect(text).not.toMatch(/forecast|turnout|will sell|ticket sales|momentum|trend/i);
  });

  it("states a no-data act with its reason and no figure", () => {
    const base = leipzig.results[0]!;
    const noData = {
      ...base,
      status: "no-data" as const,
      rank: null,
      fit: null,
      standing: null,
      overlapTags: [],
      cityStrengths: [],
      caveats: [{ type: "no-data" as const, message: "Qloo returned no shared audience tags for this act, so no audience-taste fit is shown." }],
    };
    const facts = buildFacts(noData);
    expect(facts).toHaveLength(1);
    expect(renderTemplate(facts)).toBe(`${base.act.name} could not be scored. Qloo returned no shared audience tags for this act, so no audience-taste fit is shown.`);
  });

  it("covers an unscored act in the room line and keeps its wording singular and plural", () => {
    const one = { ...leipzig, room: { ...leipzig.room, crowdActs: leipzig.room.crowdActs.slice(0, 1) }, results: leipzig.results.slice(0, 1) };
    const line = renderTemplate(buildSlateFacts(one)).split("\n")[0];
    expect(line).toBe("Audience-taste fit compares 1 of 1 candidate act with the 1 regular-crowd act for Leipzig.");
  });
});

describe("thin data is said once per act", () => {
  const thin = (act: string, subject: string): Fact => ({ kind: "caveat", act, message: CAVEAT_WORDING["thin-data"], subject });
  const MANY = "Fewer than 15 Qloo heatmap cells back these cities, so their strength is thin data.";

  it("keeps the singular sentence for one thin city, exactly as before", () => {
    expect(renderTemplate([thin("Moderat", "London")])).toBe("London: Fewer than 15 Qloo heatmap cells back this city, so its strength is thin data.");
  });

  it("says it once, naming both cities, for two thin cities", () => {
    const text = renderTemplate([thin("Moderat", "Berlin"), thin("Moderat", "Leipzig")]);
    expect(text).toBe(`Berlin and Leipzig: ${MANY}`);
    expect(text.match(/Fewer than/g)).toHaveLength(1);
  });

  it("says it once, naming all three cities, for three thin cities", () => {
    const text = renderTemplate([thin("Moderat", "Berlin"), thin("Moderat", "Leipzig"), thin("Moderat", "London")]);
    expect(text).toBe(`Berlin, Leipzig and London: ${MANY}`);
  });

  it("merges per act, never across acts", () => {
    const text = renderTemplate([thin("A", "Berlin"), thin("A", "Leipzig"), thin("B", "Berlin")]);
    expect(text).toBe(`Berlin and Leipzig: ${MANY}\nBerlin: Fewer than 15 Qloo heatmap cells back this city, so its strength is thin data.`);
  });

  it("gives the model one merged statement and no per-city repeats, and the merged text is grounded", () => {
    const act = berlin.results[0]!;
    const facts = buildSlateFacts(berlin, { actId: act.act.qlooEntityId });
    const statements = (JSON.parse(buildUserPrompt(facts)) as { statements: { statement: string }[] }).statements.map((s) => s.statement);
    expect(statements.filter((t) => t.includes("thin data"))).toEqual(["Berlin and Leipzig have thin data: fewer than 15 Qloo heatmap cells back these cities."]);
    expect(groundingCheck(statements.join(" "), berlin)).toEqual({ ok: true });
    expect(groundingCheck(renderTemplate(facts), berlin)).toEqual({ ok: true });
  });
});
