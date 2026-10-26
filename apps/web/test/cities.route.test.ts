import { FixtureTransport, type QlooClient, type QlooTransport } from "@headliner/qloo";
import { SlateSchema, type Slate } from "@headliner/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createSlateRoute } from "../app/api/slates/route";
import { POST as citiesRoute } from "../app/api/slates/[id]/acts/[actId]/cities/route";
import { setRuntimeForTests, type Runtime } from "../src/config";
import { ApiError } from "../src/errors";
import { CITY_CONCURRENCY } from "../src/pipeline/cityStrength";
import type { CityStrengthResponse } from "../src/cityStrengthTypes";
import { counting, FIXTURE_DIR, fixtureTransport, post, ROOM, runtimeWith, type CountingTransport } from "./helpers";

const isHeatmap = (params: URLSearchParams | string): boolean => new URLSearchParams(params).get("filter.type") === "urn:heatmap";
const heatmapCalls = (t: CountingTransport): number => t.calls.filter((c) => isHeatmap(c.params)).length;

interface Made {
  slate: Slate;
  runtime: ReturnType<typeof runtimeWith>;
  transport: CountingTransport;
  actId: string;
}

async function makeSlate(transport: CountingTransport = fixtureTransport(), extra: Partial<Runtime> = {}): Promise<Made> {
  const runtime = { ...runtimeWith(transport), ...extra } as ReturnType<typeof runtimeWith>;
  setRuntimeForTests(runtime);
  const res = await createSlateRoute(post(ROOM));
  const body = (await res.json()) as { slate: Slate };
  const actId = body.slate.results.find((r) => r.act.name === "Reality Club")?.act.qlooEntityId as string;
  return { slate: body.slate, runtime, transport, actId };
}

function cities(made: Pick<Made, "slate" | "actId">, body: unknown, actId = made.actId, id = made.slate.id): Promise<Response> {
  const request = new Request(`http://localhost/api/slates/${id}/acts/${actId}/cities`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return citiesRoute(request, { params: Promise.resolve({ id, actId }) });
}

let logs: string[];
beforeEach(() => {
  logs = [];
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logs.push(args.map(String).join(" ")));
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  setRuntimeForTests(undefined);
});

describe("lazy: no heatmap call until the cities endpoint is requested", () => {
  it("the heatmap call counter is 0 after slate creation and after reading the slate", async () => {
    const made = await makeSlate();
    expect(made.transport.calls.length).toBeGreaterThan(0); // searches and compares did run
    expect(heatmapCalls(made.transport)).toBe(0);
    expect(made.slate.results.every((r) => r.cityStrengths.length === 0)).toBe(true);
    await made.runtime.store.get(made.slate.id);
    expect(heatmapCalls(made.transport)).toBe(0);
  });
});

describe("POST /api/slates/:id/acts/:actId/cities", () => {
  it("returns per-city aggregates, a thin_city_data caveat per thin city, and no_data for the empty city", async () => {
    const made = await makeSlate();
    const res = await cities(made, { cities: ["Berlin", "London", "Leipzig", "Jakarta", "Tromsø"] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as CityStrengthResponse;
    expect(heatmapCalls(made.transport)).toBe(5);
    expect(body.status).toBe("done");
    const by = Object.fromEntries(body.cities.map((c) => [c.city, c]));
    expect(by["Berlin"]).toMatchObject({ status: "ok", cellCount: 6, thin: true });
    expect(by["London"]).toMatchObject({ status: "ok", cellCount: 44, thin: false });
    expect(by["Leipzig"]).toMatchObject({ status: "ok", cellCount: 1, thin: true });
    expect(by["Jakarta"]).toMatchObject({ status: "ok", cellCount: 686, thin: false });
    expect(by["Tromsø"]).toMatchObject({ status: "no_data", reason: "zero_cells" });
    expect(body.caveats.map((c) => c.city).sort()).toEqual(["Berlin", "Leipzig"]);
    expect(body.caveats.every((c) => c.code === "thin_city_data")).toBe(true);
    for (const entry of body.cities) for (const ref of entry.evidenceRefs) expect(body.evidence.some((e) => e.id === ref)).toBe(true);
    // aggregates only: no grid, coordinates or raw affinity/popularity reach the client
    expect(JSON.stringify(body)).not.toMatch(/"heatmap"|latitude|longitude|geohash|"affinity"|"popularity"/);
  });

  it("a second identical request makes no new heatmap calls (cache read-through)", async () => {
    const made = await makeSlate();
    await cities(made, { cities: ["Berlin", "London"] });
    expect(heatmapCalls(made.transport)).toBe(2);
    const again = await cities(made, { cities: ["Berlin", "London"] });
    expect(again.status).toBe(200);
    expect(heatmapCalls(made.transport)).toBe(2);
  });

  it("repeats of a city (any case) count once", async () => {
    const made = await makeSlate();
    const res = await cities(made, { cities: ["Berlin", "berlin", " BERLIN "] });
    const body = (await res.json()) as CityStrengthResponse;
    expect(body.cities).toHaveLength(1);
    expect(heatmapCalls(made.transport)).toBe(1);
  });

  it("rejects a 6th city by schema before any call, and other malformed bodies", async () => {
    const made = await makeSlate();
    const before = made.transport.calls.length;
    const bad: unknown[] = [
      { cities: ["A", "B", "C", "D", "E", "F"] },
      { cities: [] },
      { cities: ["x".repeat(81)] },
      { cities: [""] },
      { cities: ["Ber\nlin"] },
      { cities: ["Berlin"], extra: 1 },
      { cities: "Berlin" },
      {},
      [],
      "not json {",
      "x".repeat(5000),
    ];
    for (const body of bad) {
      const res = await cities(made, body);
      expect(res.status, JSON.stringify(body).slice(0, 40)).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("invalid_input");
    }
    expect(made.transport.calls.length).toBe(before);
  });

  it("never exceeds the concurrency cap and never makes more than 5 calls per request", async () => {
    const made = await makeSlate();
    let inFlight = 0;
    let peak = 0;
    let calls = 0;
    const client = {
      ...made.runtime.client,
      whereIsPopular: async () => {
        calls += 1;
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 15));
        inFlight -= 1;
        return { data: { cellCount: 20, droppedCells: 0, meanAffinityRank: 0.5 }, evidence: { endpoint: "/v2/insights", redactedParams: { c: String(calls) }, responseDigest: "d", fetchedAt: "2026-10-26T12:00:00.000Z" }, stale: false, cached: false };
      },
    } as QlooClient;
    setRuntimeForTests({ ...made.runtime, client });
    const res = await cities(made, { cities: ["A", "B", "C", "D", "E"] });
    expect(res.status).toBe(200);
    expect(calls).toBe(5);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(CITY_CONCURRENCY);
  });

  it("one failing city is a no_data entry and the others still return (partial results)", async () => {
    const inner = new FixtureTransport(FIXTURE_DIR);
    const flaky: QlooTransport = {
      get: async (req) => (new URLSearchParams(req.params).get("filter.location.query") === "London" ? { status: 503, body: { error: "UPSTREAM-SECRET-MARKER" } } : inner.get(req)),
    };
    const made = await makeSlate(counting(flaky));
    const res = await cities(made, { cities: ["Berlin", "London", "Jakarta"] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as CityStrengthResponse;
    expect(body.cities.map((c) => [c.city, c.status])).toEqual([["Berlin", "ok"], ["London", "no_data"], ["Jakarta", "ok"]]);
    expect(body.cities[1]).toMatchObject({ reason: "unavailable", evidenceRefs: [] });
    expect(JSON.stringify(body)).not.toContain("UPSTREAM-SECRET-MARKER");
  });

  it("a city with a malformed Qloo answer is no_data (shape), not a crash", async () => {
    const inner = new FixtureTransport(FIXTURE_DIR);
    const odd: QlooTransport = {
      get: async (req) => (isHeatmap(req.params) ? { status: 200, body: { success: true, results: {} } } : inner.get(req)),
    };
    const made = await makeSlate(counting(odd));
    const res = await cities(made, { cities: ["Berlin"] });
    const body = (await res.json()) as CityStrengthResponse;
    expect(body.cities).toEqual([{ city: "Berlin", status: "no_data", reason: "shape", evidenceRefs: [] }]);
  });

  it("persists aggregates only: the stored slate has per-city mean, count, thin flag and evidence, no per-cell data", async () => {
    const made = await makeSlate();
    await cities(made, { cities: ["Berlin", "London", "Jakarta", "Tromsø"] });
    const stored = (await made.runtime.store.get(made.slate.id)) as Slate;
    expect(SlateSchema.safeParse(stored).success).toBe(true);
    const act = stored.results.find((r) => r.act.qlooEntityId === made.actId);
    expect(act?.cityStrengths.map((c) => c.city)).toEqual(["Berlin", "Jakarta", "London"]);
    for (const c of act?.cityStrengths ?? []) {
      expect(Object.keys(c).sort()).toEqual(["cellCount", "city", "evidenceRefs", "meanAffinityRank", "thinData"]);
      for (const ref of c.evidenceRefs) expect(act?.evidence.some((e) => e.id === ref)).toBe(true);
    }
    expect(act?.caveats.filter((c) => c.type === "thin-data").map((c) => c.subject)).toEqual(["Berlin"]);
    // the empty city adds nothing numeric to the stored copy
    expect(act?.cityStrengths.some((c) => c.city === "Tromsø")).toBe(false);
    const text = JSON.stringify(stored);
    expect(text).not.toMatch(/"heatmap"|latitude|longitude|geohash|"affinity"|"affinity_rank"|"popularity"/);
    // other acts are untouched
    expect(stored.results.filter((r) => r.act.qlooEntityId !== made.actId).every((r) => r.cityStrengths.length === 0)).toBe(true);
  });

  it("a later request replaces a city instead of duplicating it, and two acts opened together both keep their cities", async () => {
    const made = await makeSlate();
    const radiohead = made.slate.results.find((r) => r.act.name === "Radiohead")?.act.qlooEntityId as string;
    await Promise.all([cities(made, { cities: ["Berlin", "London"] }), cities(made, { cities: ["Berlin", "Jakarta"] }, radiohead)]);
    await cities(made, { cities: ["Berlin"] });
    const stored = (await made.runtime.store.get(made.slate.id)) as Slate;
    expect(stored.results.find((r) => r.act.qlooEntityId === made.actId)?.cityStrengths.map((c) => c.city)).toEqual(["Berlin", "London"]);
    expect(stored.results.find((r) => r.act.qlooEntityId === radiohead)?.cityStrengths.map((c) => c.city)).toEqual(["Berlin", "Jakarta"]);
  });

  it("a store failure does not lose the answer", async () => {
    const made = await makeSlate();
    setRuntimeForTests({ ...made.runtime, store: { save: made.runtime.store.save.bind(made.runtime.store), get: made.runtime.store.get.bind(made.runtime.store), update: async () => { throw new Error("db password hunter2"); } } });
    const res = await cities(made, { cities: ["Berlin"] });
    expect(res.status).toBe(200);
    expect(JSON.stringify(logs)).not.toContain("hunter2");
  });

  it("calls the budget hook with the planned call count first, and a refusal makes no Qloo call", async () => {
    const seen: number[] = [];
    const made = await makeSlate();
    const before = made.transport.calls.length;
    setRuntimeForTests({
      ...made.runtime,
      budget: async ({ plannedCalls }) => {
        seen.push(plannedCalls);
        throw new ApiError("rate_limited");
      },
    });
    const res = await cities(made, { cities: ["Berlin", "London", "berlin"] });
    expect(seen).toEqual([2]);
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("rate_limited");
    expect(made.transport.calls.length).toBe(before);
  });

  it("404 for an unknown slate, an unknown act, an unmatched act and malformed ids", async () => {
    const made = await makeSlate();
    const unmatched = made.slate.results.find((r) => r.act.qlooEntityId.startsWith("unmatched:"))?.act.qlooEntityId;
    const ok = { cities: ["Berlin"] };
    expect((await cities(made, ok, made.actId, "A".repeat(21))).status).toBe(404);
    expect((await cities(made, ok, "00000000-0000-0000-0000-000000000000")).status).toBe(404);
    expect((await cities(made, ok, made.actId, "short")).status).toBe(404);
    expect((await cities(made, ok, "x".repeat(101))).status).toBe(404);
    if (unmatched) expect((await cities(made, ok, unmatched)).status).toBe(404);
    expect(heatmapCalls(made.transport)).toBe(0);
  });

  it("accepts the entity id in any letter case", async () => {
    const made = await makeSlate();
    const res = await cities(made, { cities: ["Leipzig"] }, made.actId.toLowerCase());
    expect(res.status).toBe(200);
  });
});
