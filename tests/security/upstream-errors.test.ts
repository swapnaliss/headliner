import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../apps/web/app/api/slates/route";
import { setRuntimeForTests } from "../../apps/web/src/config";
import { ERROR_CODES } from "../../apps/web/src/errors";
import { post, ROOM } from "../../apps/web/test/helpers";
import { FAKE_KEY, runtimeOver } from "./support";

/**
 * M4-03 scope 6. The Qloo adapter receives 429, 500, a timeout, malformed JSON and a 200 with the wrong shape;
 * the HTTP body the client gets is only `{ error: { code, message } }` with a fixed message per code. Never
 * upstream text, a URL, a stack, the key or a header name. Adapter-level cases: packages/qloo/test/redaction.test.ts.
 */

const MARKER = "UPSTREAM-LEAK-MARKER";
const HOSTILE = { errors: [{ message: `${MARKER} stack at /srv/qloo/internal.js:12`, url: "https://hackathon.api.qloo.com/search?apikey=abc", detail: FAKE_KEY }] };

const FIXED_MESSAGES = new Set([
  "The request is not valid.",
  "Too many requests to the data provider. Try again in a minute.",
  "The data provider is unavailable. Try again shortly.",
  "Something went wrong on our side.",
]);

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

interface Case {
  name: string;
  fetchFn: typeof fetch;
  status: number;
  code: (typeof ERROR_CODES)[number];
  timeoutMs?: number;
}

const never = ((_u: unknown, init?: RequestInit) =>
  new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException(`${MARKER} aborted`, "AbortError"))))) as typeof fetch;

const CASES: Case[] = [
  { name: "429 with a verbose body", fetchFn: (async () => json(429, HOSTILE)) as typeof fetch, status: 429, code: "rate_limited" },
  { name: "500 with a verbose body", fetchFn: (async () => json(500, HOSTILE)) as typeof fetch, status: 503, code: "upstream_unavailable" },
  { name: "502 HTML error page", fetchFn: (async () => new Response(`<html>${MARKER}</html>`, { status: 502 })) as typeof fetch, status: 503, code: "upstream_unavailable" },
  { name: "timeout", fetchFn: never, status: 503, code: "upstream_unavailable", timeoutMs: 15 },
  { name: "connection error that carries the URL and key", fetchFn: (async () => { throw new TypeError(`fetch failed https://hackathon.api.qloo.com/x?k=${FAKE_KEY} ${MARKER}`); }) as typeof fetch, status: 503, code: "upstream_unavailable" },
  { name: "malformed JSON on a 200", fetchFn: (async () => new Response(`{"results": [ ${MARKER}`, { status: 200 })) as typeof fetch, status: 503, code: "upstream_unavailable" },
  { name: "200 with the wrong shape", fetchFn: (async () => json(200, { results: MARKER, extra: HOSTILE })) as typeof fetch, status: 503, code: "upstream_unavailable" },
  { name: "401 credential rejected", fetchFn: (async () => json(401, HOSTILE)) as typeof fetch, status: 503, code: "upstream_unavailable" },
];

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

describe("forced upstream failures give a sanitized client body", () => {
  it.each(CASES)("$name", async ({ fetchFn, status, code, timeoutMs }) => {
    setRuntimeForTests(runtimeOver(fetchFn, { timeoutMs }));
    const res = await POST(post(ROOM));
    const text = await res.text();

    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = JSON.parse(text) as { error?: { code?: string; message?: string } };
    expect(Object.keys(body)).toEqual(["error"]);
    expect(Object.keys(body.error ?? {}).sort()).toEqual(["code", "message"]);
    expect(body.error?.code).toBe(code);
    expect(FIXED_MESSAGES.has(body.error?.message ?? "")).toBe(true);

    for (const bad of [MARKER, FAKE_KEY, "qloo.com", "/srv/", "x-api-key", "stack", " at ", "hackathon"]) {
      expect(text.toLowerCase()).not.toContain(bad.toLowerCase());
      expect(logs.join("\n").toLowerCase()).not.toContain(bad.toLowerCase().replace("qloo.com", "api.qloo.com/x"));
    }
    expect(logs.join("\n")).not.toContain(MARKER);
    expect(logs.join("\n")).not.toContain(FAKE_KEY);
  });

  it("a non-Qloo exception inside the pipeline is a generic internal_error with no message", async () => {
    const boom = (async () => {
      throw new RangeError(`${MARKER} unexpected`);
    }) as typeof fetch;
    setRuntimeForTests(runtimeOver(boom));
    const res = await POST(post(ROOM));
    const text = await res.text();
    expect([500, 503]).toContain(res.status);
    expect(text).not.toContain(MARKER);
    expect(logs.join("\n")).not.toContain(MARKER);
  });
});
