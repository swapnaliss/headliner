import { createQlooClient, InMemoryCacheStore } from "@headliner/qloo";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as health } from "../app/api/health/route";
import { POST } from "../app/api/slates/route";
import { setRuntimeForTests, type Runtime } from "../src/config";
import { logQlooEvent } from "../src/log";
import { fakeTransport, fixtureTransport, post, ROOM, runtimeWith } from "./helpers";

// M3-05. The canary stands in for the Qloo key: it is set as an env var and sent as a header, and must reach no log line.
const CANARY = process.env["CANARY_KEY"] ?? "canary-value-456";
const SECRET_UPSTREAM = "UPSTREAM-SECRET-MARKER /srv/qloo/internal/path.ts sk-live-abcdef0123456789abcdef";

let lines: string[];
beforeEach(() => {
  lines = [];
  vi.stubEnv("QLOO_API_KEY", CANARY);
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void lines.push(args.map(String).join(" ")));
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  setRuntimeForTests(undefined);
});

const json = (): Record<string, unknown>[] => lines.filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as Record<string, unknown>);

/** A runtime whose client reports to the structured logger, as `buildRuntime` wires it. */
function observed(transport: Parameters<typeof runtimeWith>[0], mode: "fixtures" | "live" = "fixtures"): Runtime {
  const rt = runtimeWith(transport, mode);
  return { ...rt, client: createQlooClient({ transport, cache: new InMemoryCacheStore(), sleep: async () => undefined, jitterMs: () => 0, onEvent: logQlooEvent }) };
}

function withHeaders(body: unknown): Request {
  const base = post(body);
  return new Request(base.url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": CANARY, authorization: `Bearer ${CANARY}`, "x-forwarded-for": "203.0.113.77", cookie: `s=${CANARY}` },
    body: JSON.stringify(body),
  });
}

describe("structured logs (ADR 0010)", () => {
  it("route and adapter lines parse as JSON with run id, endpoint, latency, status and cacheHit, and never carry a header or the key", async () => {
    setRuntimeForTests(observed(fixtureTransport()));
    const res = await POST(withHeaders(ROOM));
    expect(res.status).toBe(200);
    expect((await health(new Request("http://localhost/api/health", { headers: { "x-api-key": CANARY } }))).status).toBe(200);

    const parsed = json();
    expect(parsed.length).toBeGreaterThan(5);
    for (const l of parsed) {
      expect(typeof l["runId"]).toBe("string");
      expect(typeof l["endpoint"]).toBe("string");
      expect(typeof l["latencyMs"]).toBe("number");
      expect(typeof l["status"]).toBe("number");
      expect(typeof l["cacheHit"]).toBe("boolean");
    }
    expect(parsed.some((l) => l["kind"] === "route" && l["endpoint"] === "GET /api/health" && l["status"] === 200)).toBe(true);

    const text = lines.join("\n").toLowerCase();
    for (const bad of ["x-api-key", "authorization", "cookie", CANARY, "203.0.113.77", "bearer"]) expect(text).not.toContain(bad.toLowerCase());
    // No request value either: only parameter names.
    expect(text).not.toContain("reality club");
    const qloo = parsed.filter((l) => l["kind"] === "qloo");
    expect(qloo.length).toBeGreaterThan(0);
    for (const l of qloo) expect(Array.isArray(l["params"])).toBe(true);
  });

  it("the same run id is on the route line and its adapter lines in one slate request, with call counts", async () => {
    setRuntimeForTests(observed(fixtureTransport()));
    await POST(withHeaders(ROOM));
    const parsed = json();
    const route = parsed.filter((l) => l["kind"] === "route" && l["endpoint"] === "POST /api/slates");
    expect(route).toHaveLength(1);
    const runId = route[0]?.["runId"];
    const adapter = parsed.filter((l) => l["kind"] === "qloo");
    expect(adapter.length).toBeGreaterThan(0);
    expect(new Set(adapter.map((l) => l["runId"]))).toEqual(new Set([runId]));
    const counts = route[0]?.["qloo"] as { upstreamCalls: number; retries: number; status429: number; cacheHits: number };
    expect(counts.upstreamCalls).toBe(adapter.filter((l) => l["cacheHit"] === false && (l["status"] as number) > 0 && !l["errorCode"]).length);
    expect(counts.upstreamCalls).toBeGreaterThan(0);
    expect(counts.retries).toBe(0);
    expect(counts.status429).toBe(0);
  });

  it("two requests get different run ids, and a repeat served from cache reports cacheHit", async () => {
    setRuntimeForTests(observed(fixtureTransport()));
    await POST(withHeaders(ROOM));
    await POST(withHeaders(ROOM));
    const routes = json().filter((l) => l["kind"] === "route");
    expect(routes).toHaveLength(2);
    expect(routes[0]?.["runId"]).not.toBe(routes[1]?.["runId"]);
    expect(routes[0]?.["cacheHit"]).toBe(false);
    expect(routes[1]?.["cacheHit"]).toBe(true);
  });

  it("counts retries and 429s from the adapter in the route line", async () => {
    let n = 0;
    const inner = fixtureTransport();
    setRuntimeForTests(observed(fakeTransport(async (req) => (n++ === 0 ? { status: 429, body: SECRET_UPSTREAM } : inner.get(req))), "live"));
    await POST(withHeaders(ROOM));
    const route = json().find((l) => l["kind"] === "route");
    const counts = route?.["qloo"] as { retries: number; status429: number; upstreamCalls: number };
    expect(counts.status429).toBe(1);
    expect(counts.retries).toBe(1);
    expect(counts.upstreamCalls).toBeGreaterThan(1);
    expect(lines.join("\n")).not.toContain("UPSTREAM-SECRET-MARKER");
  });

  it.each([
    ["a 500 with a secret-looking body", async () => ({ status: 500, body: { error: SECRET_UPSTREAM } })],
    ["a 200 with a malformed body", async () => ({ status: 200, body: { results: SECRET_UPSTREAM } })],
    ["a transport that throws secret text", async () => Promise.reject(new Error(SECRET_UPSTREAM))],
  ])("raw upstream text never reaches the logs or the client: %s", async (_name, handler) => {
    setRuntimeForTests(observed(fakeTransport(handler), "live"));
    const res = await POST(withHeaders(ROOM));
    expect(res.status).toBeGreaterThanOrEqual(500);
    const body = await res.text();
    const text = `${body}\n${lines.join("\n")}`;
    for (const bad of ["UPSTREAM-SECRET-MARKER", "/srv/qloo", "sk-live-", CANARY, "x-api-key"]) expect(text).not.toContain(bad);
    const route = json().find((l) => l["kind"] === "route");
    expect(route?.["status"]).toBe(res.status);
    expect(typeof route?.["errorCode"]).toBe("string");
  });

  it("a handler that throws is logged as 500 with a fixed code and the error text stays out", async () => {
    const { logged } = await import("../src/log");
    const wrapped = logged("GET /api/boom", async () => {
      throw new Error(SECRET_UPSTREAM);
    });
    await expect(wrapped()).rejects.toThrow();
    const route = json().find((l) => l["endpoint"] === "GET /api/boom");
    expect(route).toMatchObject({ kind: "route", status: 500, errorCode: "unhandled" });
    expect(lines.join("\n")).not.toContain("UPSTREAM-SECRET-MARKER");
  });
});

describe("GET /api/health", () => {
  it("answers ok with the mode and no secrets", async () => {
    const res = await health(new Request("http://localhost/api/health", { headers: { "x-api-key": CANARY } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; mode: string };
    expect(body.ok).toBe(true);
    expect(["fixtures", "live"]).toContain(body.mode);
    expect(JSON.stringify(body)).not.toContain(CANARY);
  });
});
