import { afterEach, describe, expect, it, vi } from "vitest";
import { createQlooClient } from "../src/client";
import { QlooBadRequest, QlooRateLimited, QlooTimeout, QlooUnavailable } from "../src/errors";
import { Limiter } from "../src/limiter";
import { fakeTransport, fixtureBody, searchOk } from "./helpers";

afterEach(() => vi.useRealTimers());

function fakeSignal(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms); // goes through the fake timers, unlike AbortSignal.timeout
  return c.signal;
}

describe("timeout (10 s, fake timers)", () => {
  it("aborts at exactly 10 s, retries once, then raises QlooTimeout", async () => {
    vi.useFakeTimers();
    const sleeps: number[] = [];
    const t = fakeTransport(() => new Promise(() => undefined)); // never answers
    const c = createQlooClient({
      transport: t,
      timeoutSignal: fakeSignal,
      sleep: async (ms) => void sleeps.push(ms),
      jitterMs: () => 333,
    });
    let outcome: unknown = "pending";
    void c.search("Apparat").then(
      (v) => (outcome = v),
      (e: unknown) => (outcome = e),
    );
    await vi.advanceTimersByTimeAsync(9_999);
    expect(outcome).toBe("pending");
    expect(t.calls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(1); // 10 000 ms: first attempt times out
    expect(t.calls.length).toBe(2); // exactly one retry
    expect(sleeps).toEqual([333]);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(outcome).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toBeInstanceOf(QlooTimeout);
    expect(t.calls.length).toBe(2); // never a third
  });

  it("the signal passed to the transport is the timeout signal", async () => {
    let seen: AbortSignal | undefined;
    const t = fakeTransport((req) => {
      seen = req.signal;
      return searchOk();
    });
    await createQlooClient({ transport: t }).search("Apparat");
    expect(seen).toBeInstanceOf(AbortSignal);
  });
});

describe("retry policy", () => {
  it.each([429, 500, 502, 503])("%i: exactly one retry, after jitter, and a good second answer succeeds", async (status) => {
    const sleeps: number[] = [];
    const t = fakeTransport((_r, n) => (n === 1 ? { status, body: { error: "UPSTREAM-DETAIL" } } : searchOk()));
    const c = createQlooClient({ transport: t, sleep: async (ms) => void sleeps.push(ms), jitterMs: () => 412 });
    const r = await c.search("Apparat");
    expect(r.data[0]?.name).toBe("Apparat");
    expect(t.calls.length).toBe(2);
    expect(sleeps).toEqual([412]);
  });

  it("default jitter is random within a bounded window", async () => {
    const sleeps: number[] = [];
    for (let i = 0; i < 30; i++) {
      const t = fakeTransport((_r, n) => (n === 1 ? { status: 503, body: {} } : searchOk()));
      await createQlooClient({ transport: t, sleep: async (ms) => void sleeps.push(ms) }).search(`Act ${i}`);
    }
    expect(Math.min(...sleeps)).toBeGreaterThanOrEqual(250);
    expect(Math.max(...sleeps)).toBeLessThan(750);
    expect(new Set(sleeps).size).toBeGreaterThan(1);
  });

  it("persistent 503: one retry only, then QlooUnavailable", async () => {
    const t = fakeTransport(() => ({ status: 503, body: {} }));
    const c = createQlooClient({ transport: t, sleep: async () => undefined });
    await expect(c.search("Apparat")).rejects.toBeInstanceOf(QlooUnavailable);
    expect(t.calls.length).toBe(2);
  });

  it("persistent 429: one retry only, then QlooRateLimited", async () => {
    const t = fakeTransport(() => ({ status: 429, body: {} }));
    const c = createQlooClient({ transport: t, sleep: async () => undefined });
    await expect(c.search("Apparat")).rejects.toBeInstanceOf(QlooRateLimited);
    expect(t.calls.length).toBe(2);
  });

  it.each([400, 404, 422])("%i: zero retries, QlooBadRequest", async (status) => {
    const t = fakeTransport(() => ({ status, body: { errors: [{ message: "x" }] } }));
    const c = createQlooClient({ transport: t, sleep: async () => undefined });
    await expect(c.search("Apparat")).rejects.toBeInstanceOf(QlooBadRequest);
    expect(t.calls.length).toBe(1);
  });

  it.each([401, 403])("%i: zero retries, unavailable (credentials)", async (status) => {
    const t = fakeTransport(() => ({ status, body: {} }));
    const c = createQlooClient({ transport: t, sleep: async () => undefined });
    await expect(c.search("Apparat")).rejects.toBeInstanceOf(QlooUnavailable);
    expect(t.calls.length).toBe(1);
  });

  it("a transport exception is unavailable with a safe message and no retry", async () => {
    const t = fakeTransport(() => {
      throw new Error("connect ECONNREFUSED https://hackathon.api.qloo.com/search?query=x");
    });
    const c = createQlooClient({ transport: t });
    const err = (await c.search("Apparat").catch((e: unknown) => e)) as Error;
    expect(err).toBeInstanceOf(QlooUnavailable);
    expect(err.message).not.toContain("ECONNREFUSED");
    expect(t.calls.length).toBe(1);
  });
});

describe("429 is a hard stop (BL-01)", () => {
  it("after a 429 survives the retry, further live calls are refused without touching Qloo until the cooldown passes", async () => {
    let clock = new Date("2026-10-26T10:00:00Z");
    let limited = true;
    const t = fakeTransport(() => (limited ? { status: 429, body: {} } : searchOk()));
    const c = createQlooClient({ transport: t, now: () => clock, sleep: async () => undefined, rateLimitCooldownMs: 60_000 });
    await expect(c.search("Apparat")).rejects.toBeInstanceOf(QlooRateLimited);
    expect(t.calls.length).toBe(2);
    await expect(c.search("Moderat")).rejects.toBeInstanceOf(QlooRateLimited);
    expect(t.calls.length).toBe(2); // refused locally: no quota spent
    clock = new Date(clock.getTime() + 61_000);
    limited = false;
    await expect(c.search("Moderat")).resolves.toMatchObject({ cached: false });
    expect(t.calls.length).toBe(3);
  });
});

describe("concurrency cap of 6", () => {
  it("never more than 6 in flight across 20 parallel requests, and all 20 complete", async () => {
    let active = 0;
    let max = 0;
    const t = fakeTransport(async () => {
      active += 1;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return { status: 200, body: fixtureBody("search--apparat.json") };
    });
    const c = createQlooClient({ transport: t });
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => c.search(`Act number ${i}`)));
    expect(results.length).toBe(20);
    expect(t.calls.length).toBe(20);
    expect(max).toBeLessThanOrEqual(6);
    expect(max).toBe(6); // the cap is actually reached, so the test can fail
  });

  it("identical concurrent requests share one live call", async () => {
    const t = fakeTransport(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return searchOk();
    });
    const c = createQlooClient({ transport: t });
    await Promise.all(Array.from({ length: 5 }, () => c.search("Apparat")));
    expect(t.calls.length).toBe(1);
  });

  it("Limiter releases its slot when a task throws", async () => {
    const l = new Limiter(1);
    await expect(l.run(async () => Promise.reject(new Error("x")))).rejects.toThrow("x");
    await expect(l.run(async () => 7)).resolves.toBe(7);
    expect(l.inFlight).toBe(0);
    expect(() => new Limiter(0)).toThrow(RangeError);
  });
});
