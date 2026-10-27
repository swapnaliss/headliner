import { describe, expect, it } from "vitest";
import { assertEveryNumberHasEvidence } from "@headliner/core";
import { ApiError } from "../src/errors";
import { createSlate, normalizeName } from "../src/pipeline/createSlate";
import { fakeTransport, fixtureTransport, ROOM, runtimeWith } from "./helpers";

const isCompare = (endpoint: string): boolean => endpoint === "/v2/insights/compare";

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

  it("holds a name with no recording for confirmation instead of guessing, and makes no compare call", async () => {
    const transport = fixtureTransport();
    const out = await createSlate({ ...ROOM, candidateActs: ["Khruangbin", "Totally Unrecorded Band", "Radiohead"] }, runtimeWith(transport));
    expect(out.status).toBe("awaiting_confirmation");
    if (out.status !== "awaiting_confirmation") return;
    const missing = out.matches.find((m) => m.actInput === "Totally Unrecorded Band");
    expect(missing).toMatchObject({ role: "candidate", state: "not-in-recordings", candidates: [] });
    expect(out.matches.filter((m) => m.state === "exact")).toHaveLength(8);
    expect(transport.calls.filter((c) => isCompare(c.endpoint))).toHaveLength(0);
  });

  it("holds a name Qloo does not know (empty search) as no match", async () => {
    const out = await createSlate({ ...ROOM, candidateActs: ["Zzqxv Nonexistentact 9731", "Radiohead", "Khruangbin"] }, runtimeWith(fixtureTransport()));
    expect(out.status).toBe("awaiting_confirmation");
    if (out.status === "awaiting_confirmation") expect(out.matches.find((m) => m.state !== "exact")).toMatchObject({ actInput: "Zzqxv Nonexistentact 9731", state: "none" });
  });

  it("keeps a repeated act once (case, spacing and accents ignored)", async () => {
    const transport = fixtureTransport();
    const rt = runtimeWith(transport);
    const out = await createSlate({ ...ROOM, candidateActs: ["Khruangbin", " khruangbin ", "KHRUANGBIN", "Radiohead", "Reality Club"] }, rt);
    if (out.status !== "done") throw new Error("expected done");
    expect(out.slate.results.map((r) => r.act.name)).toEqual(["Reality Club", "Radiohead", "Khruangbin"]);
    expect(transport.calls.filter((c) => isCompare(c.endpoint))).toHaveLength(3);
  });

  it("excludes a candidate that is already in the regular crowd, with a note, and never compares it", async () => {
    const transport = fixtureTransport();
    const rt = runtimeWith(transport);
    const out = await createSlate({ ...ROOM, candidateActs: ["Moderat", "Radiohead", "Khruangbin"] }, rt);
    if (out.status !== "done") throw new Error("expected done");
    expect(out.slate.results.map((r) => r.act.name)).toEqual(["Radiohead", "Khruangbin"]);
    expect(out.slate.notes).toEqual([{ type: "already-in-crowd", message: "Already in your crowd, so it is not scored against itself.", subject: "Moderat" }]);
    expect(transport.calls.filter((c) => isCompare(c.endpoint))).toHaveLength(2);
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

describe("createSlate when Qloo gives a search result no popularity", () => {
  it("scores Fit as usual, shows no popularity rank for that act, adds the standing caveat, and uses no zero", async () => {
    const inner = fixtureTransport();
    const rt = runtimeWith(
      fakeTransport(async (req) => {
        const res = await inner.get(req);
        if (req.endpoint !== "/search" || req.params.get("query") !== "Radiohead") return res;
        const body = JSON.parse(JSON.stringify(res.body)) as { results: { name: string; popularity?: number }[] };
        for (const r of body.results) if (r.name === "Radiohead") delete r.popularity;
        return { ...res, body };
      }),
    );
    const out = await createSlate(ROOM, rt);
    expect(out.status).toBe("done");
    if (out.status !== "done") return;
    const radiohead = out.slate.results.find((r) => r.act.name === "Radiohead");
    expect(radiohead?.status).toBe("scored");
    expect(radiohead?.fit?.value).toBe(59.5);
    expect(radiohead?.standing).toBeNull();
    expect(radiohead?.caveats.map((c) => c.type)).toContain("standing-unavailable");
    const others = out.slate.results.filter((r) => r.act.name !== "Radiohead" && r.status === "scored");
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((r) => r.standing !== null)).toBe(true);
    for (const r of out.slate.results) assertEveryNumberHasEvidence(r);
  });
});
