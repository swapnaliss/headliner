import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setRuntimeForTests } from "../src/config";
import { GET as health } from "../app/api/health/route";
import { POST } from "../app/api/slates/route";
import { fakeTransport, fixtureTransport, post, ROOM, runtimeWith } from "./helpers";

const KEY = ["sk", "test", "0123456789abcdef0123456789abcdef"].join("-"); // assembled so no secret-shaped literal is committed
const SECRET_UPSTREAM = "UPSTREAM-SECRET-MARKER /srv/qloo/internal/path.ts";

let logs: string[];
beforeEach(() => {
  logs = [];
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logs.push(args.map(String).join(" ")));
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setRuntimeForTests(undefined);
});

describe("POST /api/slates in fixtures mode with no keys", () => {
  it("returns 200 with ranked results, fit, overlap tags, standing, caveats and evidence per number", async () => {
    vi.stubEnv("QLOO_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("DEMO_MODE", "fixtures");
    setRuntimeForTests(undefined); // build the real fixtures runtime from the (empty) environment

    const res = await POST(post(ROOM));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      id: string;
      slate: { results: { act: { name: string }; rank: number | null; fit: { value: number; evidenceRefs: string[] } | null; overlapTags: unknown[]; standing: { caption: string; evidenceRefs: string[] } | null; caveats: unknown[]; evidence: { id: string; redactedParams: Record<string, string> }[] }[] };
    };
    expect(body.status).toBe("done");
    expect(body.id).toMatch(/^[A-Za-z0-9_-]{21}$/);
    const scored = body.slate.results.filter((r) => r.rank !== null);
    expect(scored.map((r) => r.act.name)).toEqual(["Reality Club", "Radiohead", "Khruangbin"]);
    for (const r of scored) {
      expect(r.fit?.value).toBeGreaterThan(0);
      expect(r.overlapTags.length).toBeGreaterThan(0);
      expect(r.standing?.caption).toBe("Qloo popularity rank");
      expect(Array.isArray(r.caveats)).toBe(true);
      const ids = new Set(r.evidence.map((e) => e.id));
      expect(r.fit?.evidenceRefs.length).toBeGreaterThanOrEqual(1);
      for (const ref of [...(r.fit?.evidenceRefs ?? []), ...(r.standing?.evidenceRefs ?? [])]) expect(ids.has(ref)).toBe(true);
    }
    expect(JSON.stringify(body)).not.toMatch(/x-api-key|api[_-]?key/i);
  });

  it("makes zero network calls: a fetch stub that throws is never reached", async () => {
    const fetchStub = vi.fn(() => {
      throw new Error("network is blocked");
    });
    vi.stubGlobal("fetch", fetchStub);
    setRuntimeForTests(runtimeWith(fixtureTransport()));
    const res = await POST(post(ROOM));
    expect(res.status).toBe(200);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("returns the single error format for ambiguity as a 200 awaiting_confirmation body", async () => {
    const real = fixtureTransport();
    const transport = fakeTransport(async (req) => {
      if (req.endpoint === "/search" && req.params.get("query") === "Radiohead") {
        return {
          status: 200,
          body: { results: [1, 2].map((n) => ({ entity_id: `AAAAAAAA-0000-4000-8000-00000000000${n}`, name: "Radiohead", popularity: 0.5, types: ["urn:entity:artist"] })) },
        };
      }
      return real.get(req);
    });
    setRuntimeForTests(runtimeWith(transport));
    const res = await POST(post(ROOM));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe("awaiting_confirmation");
  });
});

describe("input limits are enforced before the adapter", () => {
  const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `Act ${i}`);
  const cases: [string, unknown][] = [
    ["13 candidates", { ...ROOM, candidateActs: names(13) }],
    ["7 crowd acts", { ...ROOM, crowdActs: names(7) }],
    ["2 crowd acts", { ...ROOM, crowdActs: names(2) }],
    ["no candidates", { ...ROOM, candidateActs: [] }],
    ["81-character name", { ...ROOM, candidateActs: ["x".repeat(81)] }],
    ["81-character city", { ...ROOM, city: "c".repeat(81) }],
    ["empty city", { ...ROOM, city: "" }],
    ["blank city", { ...ROOM, city: "   " }],
    ["control character NUL", { ...ROOM, candidateActs: ["Bad\u0000Name"] }],
    ["control character newline", { ...ROOM, crowdActs: ["Apparat", "Moderat", "Evil\nName"] }],
    ["control character in city", { ...ROOM, city: "Ber\u001blin" }],
    ["line separator", { ...ROOM, candidateActs: ["a" + String.fromCharCode(0x2028) + "b"] }],
    ["non-string name", { ...ROOM, candidateActs: [42] }],
    ["unknown field", { ...ROOM, extra: true }],
    ["only a city", { city: "" }],
    ["array body", []],
    ["null body", null],
    ["malformed JSON", "{not json"],
    ["oversized body", " ".repeat(20_000) + "{}"],
  ];

  it.each(cases)("rejects %s with 400 invalid_input and never calls the adapter", async (_label, body) => {
    const transport = fixtureTransport();
    setRuntimeForTests(runtimeWith(transport));
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(Object.keys(json)).toEqual(["error"]);
    expect(json.error.code).toBe("invalid_input");
    expect(typeof json.error.message).toBe("string");
    expect(transport.calls).toHaveLength(0);
  });

  it("does not echo the offending input back", async () => {
    setRuntimeForTests(runtimeWith(fixtureTransport()));
    const res = await POST(post({ ...ROOM, candidateActs: ["Bad\u0000Name"], city: "ECHO-CHECK" }));
    const text = await res.text();
    expect(text).not.toContain("Bad");
    expect(text).toContain("candidateActs");
  });

  it("accepts the limits exactly: 6 crowd acts, 12 candidates, 80-character names", async () => {
    const transport = fixtureTransport();
    setRuntimeForTests(runtimeWith(transport));
    const res = await POST(post({ city: "c".repeat(80), crowdActs: ROOM.crowdActs, candidateActs: [...ROOM.candidateActs, ...Array.from({ length: 8 }, (_, i) => `Unrecorded ${i}`), "y".repeat(80)].slice(0, 12) }));
    expect(res.status).toBe(200);
  });
});

describe("safe errors and no leaks", () => {
  const key = KEY;

  function assertClean(text: string): void {
    for (const bad of [key, "x-api-key", "X-Api-Key", SECRET_UPSTREAM, "UPSTREAM-SECRET-MARKER", "/srv/qloo"]) {
      expect(text.toLowerCase()).not.toContain(bad.toLowerCase());
    }
    expect(text).not.toMatch(/sk-[A-Za-z0-9-]{16,}/);
  }

  it("a 500 with a hostile body gives upstream_unavailable and leaks nothing (live mode)", async () => {
    setRuntimeForTests(runtimeWith(fakeTransport(async () => ({ status: 500, body: { error: SECRET_UPSTREAM, key } })), "live"));
    const res = await POST(post(ROOM));
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: "upstream_unavailable", message: "The data provider is unavailable. Try again shortly." } });
    assertClean(text);
    assertClean(logs.join("\n"));
    expect(logs.length).toBeGreaterThan(0);
  });

  it("a 429 gives rate_limited", async () => {
    setRuntimeForTests(runtimeWith(fakeTransport(async () => ({ status: 429, body: SECRET_UPSTREAM })), "live"));
    const res = await POST(post(ROOM));
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("rate_limited");
    assertClean(logs.join("\n"));
  });

  it("a transport exception that carries the key and URL leaks nothing", async () => {
    const transport = fakeTransport(async () => {
      throw new Error(`fetch failed https://hackathon.api.qloo.com/search?x=1 X-Api-Key: ${key} ${SECRET_UPSTREAM}`);
    });
    setRuntimeForTests(runtimeWith(transport, "live"));
    const res = await POST(post(ROOM));
    assertClean(await res.text());
    assertClean(logs.join("\n"));
  });

  it("a failing compare in a slate keeps the slate and leaks nothing", async () => {
    const real = fixtureTransport();
    const transport = fakeTransport(async (req) => {
      if (req.endpoint !== "/search") throw new Error(`${SECRET_UPSTREAM} ${key}`);
      return real.get(req);
    });
    setRuntimeForTests(runtimeWith(transport));
    const res = await POST(post(ROOM));
    expect(res.status).toBe(200);
    const text = await res.text();
    assertClean(text);
    assertClean(logs.join("\n"));
    expect((JSON.parse(text) as { slate: { results: { status: string }[] } }).slate.results.every((r) => r.status === "no-data")).toBe(true);
  });

  it("an unexpected bug returns internal_error with no detail", async () => {
    const runtime = runtimeWith(fixtureTransport());
    setRuntimeForTests({ ...runtime, store: { save: async () => { throw new Error(`db password ${key}`); } } });
    const res = await POST(post(ROOM));
    expect(res.status).toBe(500);
    const text = await res.text();
    assertClean(text);
    assertClean(logs.join("\n"));
    expect(JSON.parse(text).error.code).toBe("internal_error");
  });
});

describe("GET /api/health", () => {
  it("reports the mode", async () => {
    vi.stubEnv("DEMO_MODE", "fixtures");
    const res = await health(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mode: "fixtures" });
  });
});
