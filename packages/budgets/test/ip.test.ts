import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, loadBudgetConfig } from "../src/config";
import { clientIp, ipHash, secondsToUtcMidnight, UNKNOWN_IP, utcDay } from "../src/ip";

const h = (headers: Record<string, string>): Headers => new Headers(headers);

describe("clientIp", () => {
  it("prefers the platform header, then x-real-ip, then the first x-forwarded-for hop", () => {
    expect(clientIp(h({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "198.51.100.1", "x-real-ip": "192.0.2.9" }))).toBe("203.0.113.7");
    expect(clientIp(h({ "x-real-ip": "192.0.2.9", "x-forwarded-for": "198.51.100.1" }))).toBe("192.0.2.9");
    expect(clientIp(h({ "x-forwarded-for": "198.51.100.1, 10.0.0.1, 10.0.0.2" }))).toBe("198.51.100.1");
  });

  it("maps a missing or malformed address to the one shared bucket", () => {
    for (const value of ["", "not-an-ip", "999.1.1.1", "1.2.3", "<script>", "1.2.3.4.5", "a".repeat(200), "::g", "1:2:3:4:5:6:7:8:9"]) {
      expect(clientIp(h({ "x-forwarded-for": value }))).toBe(UNKNOWN_IP);
    }
    expect(clientIp(h({}))).toBe(UNKNOWN_IP);
  });

  it("buckets IPv6 by its /64 and unwraps an IPv4-mapped address", () => {
    const a = clientIp(h({ "x-forwarded-for": "2001:db8:abcd:12::1" }));
    const b = clientIp(h({ "x-forwarded-for": "2001:0db8:abcd:0012:ffff:ffff:ffff:ffff" }));
    const other = clientIp(h({ "x-forwarded-for": "2001:db8:abcd:13::1" }));
    expect(a).toBe("2001:0db8:abcd:0012::/64");
    expect(b).toBe(a);
    expect(other).not.toBe(a);
    expect(clientIp(h({ "x-forwarded-for": "::ffff:203.0.113.7" }))).toBe("203.0.113.7");
  });
});

describe("ipHash", () => {
  it("is a salted SHA-256 hex digest that contains no part of the address", () => {
    const hash = ipHash("203.0.113.7", "2026-10-27", "pepper-pepper");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203");
    expect(ipHash("203.0.113.7", "2026-10-27", "pepper-pepper")).toBe(hash);
  });

  it("changes with the day, the salt and the address", () => {
    const base = ipHash("203.0.113.7", "2026-10-27", "pepper-pepper");
    expect(ipHash("203.0.113.7", "2026-10-28", "pepper-pepper")).not.toBe(base);
    expect(ipHash("203.0.113.7", "2026-10-27", "other-pepper")).not.toBe(base);
    expect(ipHash("203.0.113.8", "2026-10-27", "pepper-pepper")).not.toBe(base);
  });
});

describe("UTC day helpers", () => {
  it("formats the UTC day and counts to the next UTC midnight", () => {
    const now = new Date("2026-10-27T23:59:30.000Z");
    expect(utcDay(now)).toBe("2026-10-27");
    expect(secondsToUtcMidnight(now)).toBe(30);
    expect(secondsToUtcMidnight(new Date("2026-10-27T00:00:00.000Z"))).toBe(86_400);
    expect(secondsToUtcMidnight(new Date("2026-12-31T23:59:59.500Z"))).toBe(1);
  });
});

describe("loadBudgetConfig", () => {
  it("uses the documented defaults", () => {
    const cfg = loadBudgetConfig({});
    expect(cfg).toEqual({
      ipQlooCalls: DEFAULT_LIMITS.ipQlooCalls,
      ipLlmTokens: DEFAULT_LIMITS.ipLlmTokens,
      globalQlooCalls: DEFAULT_LIMITS.globalQlooCalls,
      globalLlmTokens: DEFAULT_LIMITS.globalLlmTokens,
      salt: undefined,
    });
    expect(DEFAULT_LIMITS.ipQlooCalls).toBe(150);
    expect(DEFAULT_LIMITS.ipLlmTokens).toBe(20_000);
  });

  it("is overridable by environment variables and ignores blanks", () => {
    const cfg = loadBudgetConfig({ BUDGET_IP_QLOO_CALLS: "40", BUDGET_GLOBAL_LLM_TOKENS: "5000", BUDGET_IP_LLM_TOKENS: "", BUDGET_SALT: "long-enough-salt" });
    expect(cfg.ipQlooCalls).toBe(40);
    expect(cfg.globalLlmTokens).toBe(5000);
    expect(cfg.ipLlmTokens).toBe(DEFAULT_LIMITS.ipLlmTokens);
    expect(cfg.salt).toBe("long-enough-salt");
  });

  it("rejects malformed values instead of falling back",() => {
    for (const bad of ["-1", "1.5", "abc", "1e9", "9999999999"]) {
      let message = "";
      try {
        loadBudgetConfig({ BUDGET_IP_QLOO_CALLS: bad });
      } catch (e) {
        message = e instanceof Error ? e.message : "";
      }
      expect(message, bad).not.toBe("");
    }
    expect(() => loadBudgetConfig({ BUDGET_SALT: "short" })).toThrow();
  });
});
