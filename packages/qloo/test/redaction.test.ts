import { describe, expect, it } from "vitest";
import { createQlooClient, type QlooEvent } from "../src/client";
import { QlooError } from "../src/errors";
import { LiveTransport, liveTransportFromEnv, QLOO_BASE_URL } from "../src/transport/live";
import { fixtureBody } from "./helpers";

const TEST_KEY = "tk_7f3a9c-unit-test-credential-ZZ91";
const UPSTREAM_BODY = { errors: [{ message: "UPSTREAM-LEAK-MARKER internal stack at /srv/qloo/x.js:12", detail: TEST_KEY }] };

/** A fake fetch standing in for the network: records the request and answers as configured. */
function fakeFetch(answer: (url: URL, init: RequestInit) => Response | Promise<Response>) {
  const seen: { url: URL; init: RequestInit }[] = [];
  const fn = (async (input: URL | string, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(input);
    seen.push({ url, init: init ?? {} });
    return answer(url, init ?? {});
  }) as typeof fetch;
  return { fn, seen };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function leaks(text: string): string[] {
  return [TEST_KEY, "X-Api-Key", "x-api-key", "UPSTREAM-LEAK-MARKER", "/srv/qloo"].filter((s) => text.includes(s));
}

describe("the credential never leaves the live transport", () => {
  it("is sent as a header to the hackathon host only, and not in the URL", async () => {
    const f = fakeFetch(() => json(200, fixtureBody("search--apparat.json")));
    const c = createQlooClient({ transport: new LiveTransport({ apiKey: TEST_KEY, fetch: f.fn }) });
    await c.search("Apparat");
    const sent = f.seen[0];
    expect(sent?.url.origin).toBe(QLOO_BASE_URL);
    expect(sent?.url.toString()).not.toContain(TEST_KEY);
    const headers = sent?.init.headers as Record<string, string>;
    expect(headers["X-Api-Key"]).toBe(TEST_KEY);
  });

  it("no Evidence, result, event or cache entry contains the key or the header name", async () => {
    const f = fakeFetch(() => json(200, fixtureBody("search--apparat.json")));
    const events: QlooEvent[] = [];
    const c = createQlooClient({ transport: new LiveTransport({ apiKey: TEST_KEY, fetch: f.fn }), onEvent: (e) => events.push(e) });
    const live = await c.search("Apparat");
    const hit = await c.search("Apparat");
    expect(events.length).toBeGreaterThan(0);
    expect(leaks(JSON.stringify([live, hit, events]))).toEqual([]);
  });

  it("errors never contain the key, the header name or any upstream body, for every failure status", async () => {
    for (const status of [400, 401, 403, 404, 429, 500, 503]) {
      const f = fakeFetch(() => json(status, UPSTREAM_BODY));
      const events: QlooEvent[] = [];
      const c = createQlooClient({
        transport: new LiveTransport({ apiKey: TEST_KEY, fetch: f.fn }),
        sleep: async () => undefined,
        onEvent: (e) => events.push(e),
      });
      const err = await c.search("Apparat").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(QlooError);
      const e = err as QlooError;
      expect(leaks(`${e.message} ${e.name} ${e.stack ?? ""} ${JSON.stringify(e)} ${JSON.stringify(events)}`)).toEqual([]);
    }
  });

  it("a 200 with a wrong shape and a hostile body does not echo that body", async () => {
    const f = fakeFetch(() => json(200, { results: "UPSTREAM-LEAK-MARKER", extra: TEST_KEY }));
    const c = createQlooClient({ transport: new LiveTransport({ apiKey: TEST_KEY, fetch: f.fn }) });
    const err = (await c.search("Apparat").catch((e: unknown) => e)) as QlooError;
    expect(err.kind).toBe("shape");
    expect(leaks(`${err.message} ${JSON.stringify(err)}`)).toEqual([]);
  });

  it("a non-JSON body is a shape error without the text", async () => {
    const f = fakeFetch(() => new Response("<html>UPSTREAM-LEAK-MARKER</html>", { status: 200 }));
    const c = createQlooClient({ transport: new LiveTransport({ apiKey: TEST_KEY, fetch: f.fn }) });
    const err = (await c.search("Apparat").catch((e: unknown) => e)) as QlooError;
    expect(err.kind).toBe("shape");
    expect(leaks(err.message)).toEqual([]);
  });

  it("a fetch exception that carries the URL and key is replaced by a fixed message", async () => {
    const f = fakeFetch(() => {
      throw new TypeError(`fetch failed for ${QLOO_BASE_URL}/search?x-api-key=${TEST_KEY}`);
    });
    const c = createQlooClient({ transport: new LiveTransport({ apiKey: TEST_KEY, fetch: f.fn }) });
    const err = (await c.search("Apparat").catch((e: unknown) => e)) as QlooError;
    expect(err.kind).toBe("unavailable");
    expect(leaks(`${err.message} ${JSON.stringify(err)}`)).toEqual([]);
    expect(f.seen.length).toBe(1);
  });

  it("an aborted fetch is a timeout", async () => {
    const f = fakeFetch((_u, init) => new Promise((_res, rej) => (init.signal as AbortSignal).addEventListener("abort", () => rej(new DOMException("x", "AbortError")))));
    const c = createQlooClient({
      transport: new LiveTransport({ apiKey: TEST_KEY, fetch: f.fn }),
      timeoutMs: 20,
      sleep: async () => undefined,
    });
    const err = (await c.search("Apparat").catch((e: unknown) => e)) as QlooError;
    expect(err.kind).toBe("timeout");
    expect(f.seen.length).toBe(2);
  });
});

describe("upstream error bodies never appear in QlooError.message", () => {
  it("400 with a verbose body gives a fixed message", async () => {
    const f = fakeFetch(() => json(400, UPSTREAM_BODY));
    const c = createQlooClient({ transport: new LiveTransport({ apiKey: TEST_KEY, fetch: f.fn }) });
    const err = (await c.search("Apparat").catch((e: unknown) => e)) as QlooError;
    expect(err.kind).toBe("bad_request");
    expect(err.message).toBe("Qloo rejected the request");
  });
});

describe("live transport construction", () => {
  it("refuses an empty key and reads QLOO_API_KEY only from the env object it is given", () => {
    expect(() => new LiveTransport({ apiKey: "" })).toThrow(QlooError);
    expect(() => liveTransportFromEnv({})).toThrow(QlooError);
    expect(liveTransportFromEnv({ QLOO_API_KEY: TEST_KEY })).toBeInstanceOf(LiveTransport);
  });

  it("the thrown configuration error does not contain a key", () => {
    try {
      liveTransportFromEnv({});
    } catch (e) {
      expect(leaks((e as Error).message)).toEqual([]);
    }
  });
});
