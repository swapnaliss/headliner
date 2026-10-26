import { describe, expect, it } from "vitest";
import { assertEveryNumberHasEvidence } from "@headliner/core";
import { ApiError } from "../src/errors";
import { createSlate, normalizeName } from "../src/pipeline/createSlate";
import { fakeTransport, fixtureTransport, ROOM, runtimeWith } from "./helpers";

const isCompare = (endpoint: string): boolean => endpoint === "/v2/insights/compare";

function searchBody(entities: { id: string; name: string; popularity: number; disambiguation?: string }[]): unknown {
  return {
    results: entities.map((e) => ({
      entity_id: e.id,
      name: e.name,
      popularity: e.popularity,
      types: ["urn:entity:artist"],
      ...(e.disambiguation ? { disambiguation: e.disambiguation } : {}),
    })),
  };
}

describe("createSlate on the recorded room (fixtures)", () => {
  it("ranks the recorded candidates, then the act with no recorded compare, using only fixtures", async () => {
    const transport = fixtureTransport();
    const rt = runtimeWith(transport);
    const out = await createSlate(ROOM, rt);
    expect(out.status).toBe("done");
    if (out.status !== "done") return;

    const names = out.slate.results.map((r) => r.act.name);
    expect(names).toHaveLength(4);
    expect(out.slate.results.map((r) => r.rank)).toEqual([1, 2, 3, null]);
    expect(out.slate.results.map((r) => r.status)).toEqual(["scored", "scored", "scored", "no-data"]);
    expect(names[3]).toBe("Hindia");

    // Recorded values pinned by M1-02: Reality Club 60.6, Radiohead 59.5, Khruangbin 58.1.
    const fits = Object.fromEntries(out.slate.results.map((r) => [r.act.name, r.fit?.value]));
    expect(fits["Reality Club"]).toBe(60.6);
    expect(fits["Radiohead"]).toBe(59.5);
    expect(fits["Khruangbin"]).toBe(58.1);
    expect(names.slice(0, 3)).toEqual(["Reality Club", "Radiohead", "Khruangbin"]);

    for (const r of out.slate.results) assertEveryNumberHasEvidence(r);
    for (const r of out.slate.results.slice(0, 3)) {
      expect(r.overlapTags.length).toBeGreaterThan(0);
      expect(r.standing?.caption).toBe("Qloo popularity rank");
      expect(r.evidence.length).toBeGreaterThanOrEqual(2);
    }
    expect(out.slate.results[3]?.caveats.map((c) => c.type)).toEqual(["no-data"]);
    expect(out.slate.room.crowdActs.map((a) => a.name)).toEqual(["Apparat", "Moderat", "Modeselektor", "Hundreds", "Brandt Brauer Frick", "Boys Noize"]);

    // Call budget for this room, counted at the transport: 6 + 4 searches, 4 single-candidate compares.
    const searches = transport.calls.filter((c) => c.endpoint === "/search").length;
    const compares = transport.calls.filter((c) => isCompare(c.endpoint)).length;
    expect({ searches, compares }).toEqual({ searches: 10, compares: 4 });
    expect(transport.calls.every((c) => !isCompare(c.endpoint) || c.params.getAll("b.signal.interests.entities").join(",").split(",").length === 1)).toBe(true);
  });

  it("holds the slate in the store under a 21-character id", async () => {
    const rt = runtimeWith(fixtureTransport());
    const out = await createSlate(ROOM, rt);
    if (out.status !== "done") throw new Error("expected done");
    expect(out.id).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(await rt.store.get(out.id)).toEqual(out.slate);
    expect(out.slate.createdAt).toBe("2026-10-26T12:00:00.000Z");
  });

  it("resolves every recorded name with full confidence", async () => {
    const rt = runtimeWith(fixtureTransport());
    const names = ["Apparat", "Moderat", "Modeselektor", "Hundreds", "Brandt Brauer Frick", "Boys Noize", "Khruangbin", "Radiohead", "Reality Club", "Phoenix", "Björk", "Sigur Rós", "Odunsi (The Engine)", "Amaarae", "Hindia"];
    const out = await createSlate({ city: "Berlin", crowdActs: names.slice(0, 6), candidateActs: names.slice(6) }, rt);
    expect(out.status).toBe("done");
  });

  it("returns an honest no-data result for an act with no fixture and still ranks the rest", async () => {
    const rt = runtimeWith(fixtureTransport());
    const out = await createSlate({ ...ROOM, candidateActs: ["Khruangbin", "Totally Unrecorded Band", "Radiohead"] }, rt);
    if (out.status !== "done") throw new Error("expected done");
    expect(out.slate.results.map((r) => [r.act.name, r.rank, r.status])).toEqual([
      ["Radiohead", 1, "scored"],
      ["Khruangbin", 2, "scored"],
      ["Totally Unrecorded Band", null, "no-data"],
    ]);
    const missing = out.slate.results[2];
    expect(missing?.fit).toBeNull();
    expect(missing?.caveats[0]?.type).toBe("no-data");
    expect(missing?.evidence).toEqual([]);
  });

  it("treats a name Qloo does not know (empty search) as no-data too", async () => {
    const rt = runtimeWith(fixtureTransport());
    const out = await createSlate({ ...ROOM, candidateActs: ["Zzqxv Nonexistentact 9731", "Radiohead"] }, rt);
    if (out.status !== "done") throw new Error("expected done");
    expect(out.slate.results.map((r) => r.status)).toEqual(["scored", "no-data"]);
    expect(out.slate.results[1]?.caveats[0]?.message).toMatch(/not matched/);
  });

  it("keeps a repeated act once (case, spacing and accents ignored)", async () => {
    const transport = fixtureTransport();
    const rt = runtimeWith(transport);
    const out = await createSlate({ ...ROOM, candidateActs: ["Khruangbin", " khruangbin ", "KHRUANGBIN", "Radiohead"] }, rt);
    if (out.status !== "done") throw new Error("expected done");
    expect(out.slate.results.map((r) => r.act.name)).toEqual(["Radiohead", "Khruangbin"]);
    expect(transport.calls.filter((c) => isCompare(c.endpoint))).toHaveLength(2);
  });

  it("does not compare a candidate that is already in the regular crowd", async () => {
    const transport = fixtureTransport();
    const rt = runtimeWith(transport);
    const out = await createSlate({ ...ROOM, candidateActs: ["Moderat", "Radiohead"] }, rt);
    if (out.status !== "done") throw new Error("expected done");
    const moderat = out.slate.results.find((r) => r.act.name === "Moderat");
    expect(moderat?.status).toBe("no-data");
    expect(moderat?.caveats[0]?.message).toMatch(/already one of the regular-crowd acts/);
    expect(transport.calls.filter((c) => isCompare(c.endpoint))).toHaveLength(1);
  });
});

describe("ambiguity and unresolved crowd (fake transport)", () => {
  const phoenix = (): unknown =>
    searchBody([
      { id: "AAAAAAAA-0000-4000-8000-000000000001", name: "Phoenix", popularity: 0.99, disambiguation: "French band" },
      { id: "AAAAAAAA-0000-4000-8000-000000000002", name: "Phoenix", popularity: 0.7, disambiguation: "Australian singer" },
    ]);

  it("reports an ambiguous candidate as awaiting_confirmation and makes no compare call", async () => {
    const real = fixtureTransport();
    const transport = fakeTransport(async (req) => {
      if (req.endpoint === "/search" && req.params.get("query") === "Phoenix") return { status: 200, body: phoenix() };
      return real.get(req);
    });
    const rt = runtimeWith(transport);
    const out = await createSlate({ ...ROOM, candidateActs: ["Phoenix", "Radiohead"] }, rt);
    expect(out.status).toBe("awaiting_confirmation");
    if (out.status !== "awaiting_confirmation") return;
    expect(out.ambiguous).toHaveLength(1);
    expect(out.ambiguous[0]).toMatchObject({ role: "candidate", input: "Phoenix" });
    expect(out.ambiguous[0]?.options.map((o) => o.disambiguation)).toEqual(["French band", "Australian singer"]);
    expect(transport.calls.filter((c) => isCompare(c.endpoint))).toHaveLength(0);
    expect(await rt.store.get("x")).toBeNull();
  });

  it("reports an ambiguous crowd act the same way", async () => {
    const real = fixtureTransport();
    const transport = fakeTransport(async (req) => {
      if (req.endpoint === "/search" && req.params.get("query") === "Hundreds") return { status: 200, body: phoenix() };
      return real.get(req);
    });
    const out = await createSlate(ROOM, runtimeWith(transport));
    expect(out.status).toBe("awaiting_confirmation");
    if (out.status === "awaiting_confirmation") expect(out.ambiguous[0]).toMatchObject({ role: "crowd", input: "Hundreds" });
  });

  it("treats a search whose top hit is not the typed name as ambiguous", async () => {
    const real = fixtureTransport();
    const transport = fakeTransport(async (req) => {
      if (req.endpoint === "/search" && req.params.get("query") === "Radiohed") {
        return { status: 200, body: searchBody([{ id: "AAAAAAAA-0000-4000-8000-000000000009", name: "Radiohead", popularity: 0.9 }]) };
      }
      return real.get(req);
    });
    const out = await createSlate({ ...ROOM, candidateActs: ["Radiohed"] }, runtimeWith(transport));
    expect(out.status).toBe("awaiting_confirmation");
  });

  it("drops an unmatched crowd act, reports it, and scores against the rest", async () => {
    const rt = runtimeWith(fixtureTransport());
    const out = await createSlate({ ...ROOM, crowdActs: [...ROOM.crowdActs.slice(0, 5), "Not A Recorded Crowd Act"] }, rt);
    if (out.status !== "done") throw new Error("expected done");
    expect(out.unresolvedCrowdActs).toEqual(["Not A Recorded Crowd Act"]);
    expect(out.slate.room.crowdActs).toHaveLength(5);
    // No recording exists for a five-act crowd compare, so every candidate is honestly no-data.
    expect(out.slate.results.every((r) => r.status === "no-data")).toBe(true);
  });
});

describe("upstream failures", () => {
  it("live mode: every crowd search rate limited gives rate_limited", async () => {
    const transport = fakeTransport(async () => ({ status: 429, body: { error: "slow down" } }));
    await expect(createSlate(ROOM, runtimeWith(transport, "live"))).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("live mode: every crowd search failing upstream gives upstream_unavailable", async () => {
    const transport = fakeTransport(async () => ({ status: 503, body: {} }));
    await expect(createSlate(ROOM, runtimeWith(transport, "live"))).rejects.toBeInstanceOf(ApiError);
  });

  it("a compare that fails keeps the slate, as no-data with an unavailable caveat", async () => {
    const real = fixtureTransport();
    const transport = fakeTransport(async (req) => {
      if (isCompare(req.endpoint) && req.params.get("b.signal.interests.entities")?.startsWith("70CAE5BF")) {
        return { status: 500, body: { detail: "boom" } };
      }
      return real.get(req);
    });
    const out = await createSlate(ROOM, runtimeWith(transport, "live"));
    if (out.status !== "done") throw new Error("expected done");
    const radiohead = out.slate.results.find((r) => r.act.name === "Radiohead");
    expect(radiohead?.status).toBe("no-data");
    expect(radiohead?.caveats[0]?.message).toMatch(/No Qloo data is available/);
    expect(radiohead?.standing).not.toBeNull();
    expect(out.slate.results.filter((r) => r.status === "scored")).toHaveLength(2);
  });

  it("compares not started inside the time budget become no-data with a time-limit caveat", async () => {
    let calls = 0;
    const clock = (): number => (calls++ === 0 ? 0 : 1_000_000);
    const out = await createSlate(ROOM, runtimeWith(fixtureTransport()), { budgetMs: 1_000, clock });
    if (out.status !== "done") throw new Error("expected done");
    expect(out.slate.results.every((r) => r.status === "no-data")).toBe(true);
    expect(out.slate.results[0]?.caveats[0]?.message).toMatch(/time limit/);
  });

  it("flags a slate served from stale cache", async () => {
    const out = await createSlate(ROOM, runtimeWith(fixtureTransport()));
    if (out.status === "done") expect(out.stale).toBe(false);
  });
});

describe("normalizeName", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalizeName("Sigur Rós")).toBe(normalizeName("sigur ros"));
    expect(normalizeName("Odunsi (The Engine)")).toBe("odunsi the engine");
  });
});
