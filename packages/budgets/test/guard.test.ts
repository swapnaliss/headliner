import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@headliner/slates";
import { charge } from "../src/charge";
import { DEFAULT_LIMITS, type BudgetConfig } from "../src/config";
import { createGuard, type GuardEvent } from "../src/guard";
import { ipHash } from "../src/ip";
import { openPglite, type Handle } from "./helpers";

const NOW = new Date("2026-10-27T10:00:00.000Z");
const SALT = "unit-test-salt-value";
const config = (over: Partial<BudgetConfig> = {}): BudgetConfig => ({ ...DEFAULT_LIMITS, salt: SALT, ...over });
const asVisitor = (ip: string): Request => new Request("http://localhost/api/slates", { method: "POST", headers: { "x-forwarded-for": ip } });

let handle: Handle;
beforeAll(async () => {
  handle = await openPglite();
});
afterAll(async () => {
  await handle.close();
});
beforeEach(async () => {
  await handle.db.execute(sql`delete from budgets`);
});

function guardWith(over: Partial<BudgetConfig> = {}, events: GuardEvent[] = []) {
  return createGuard({ db: () => handle.db, config: config(over), now: () => NOW, onEvent: (e) => events.push(e) });
}

describe("guard: per-IP Qloo limit", () => {
  it("allows up to the limit, then denies with the seconds to the next UTC midnight; another IP is unaffected", async () => {
    const guard = guardWith({ ipQlooCalls: 10 });
    const first = await guard(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 6 });
    expect(first).toMatchObject({ kind: "allow", qloo: "live", llm: "on" });
    const over = await guard(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 6 });
    expect(over).toEqual({ kind: "deny", reason: "ip_limit", retryAfterSeconds: 14 * 3600 });
    const other = await guard(asVisitor("203.0.113.8"), { route: "create", qlooCalls: 6 });
    expect(other.kind).toBe("allow");
  });

  it("gives a denied reservation back, so a smaller request still fits", async () => {
    const guard = guardWith({ ipQlooCalls: 10 });
    await guard(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 6 });
    expect((await guard(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 6 })).kind).toBe("deny");
    expect((await guard(asVisitor("203.0.113.7"), { route: "cities", qlooCalls: 4 })).kind).toBe("allow");
    expect((await guard(asVisitor("203.0.113.7"), { route: "cities", qlooCalls: 1 })).kind).toBe("deny");
  });

  it("settle replaces the reservation with the calls really made (cache hits cost 0), and is idempotent", async () => {
    const guard = guardWith({ ipQlooCalls: 10 });
    const d = await guard(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 8 });
    if (d.kind !== "allow") throw new Error("expected allow");
    await d.settle({ qlooCalls: 0 });
    await d.settle({ qlooCalls: 8 });
    expect((await guard(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 10 })).kind).toBe("allow");
  });

  it("settle charges more when retries cost extra", async () => {
    const guard = guardWith({ ipQlooCalls: 10 });
    const d = await guard(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 4 });
    if (d.kind !== "allow") throw new Error("expected allow");
    await d.settle({ qlooCalls: 9 });
    expect((await guard(asVisitor("203.0.113.7"), { route: "cities", qlooCalls: 2 })).kind).toBe("deny");
    expect((await guard(asVisitor("203.0.113.7"), { route: "cities", qlooCalls: 1 })).kind).toBe("allow");
  });

  it("concurrent requests cannot overshoot the limit", async () => {
    const guard = guardWith({ ipQlooCalls: 10 });
    const decisions = await Promise.all(Array.from({ length: 30 }, () => guard(asVisitor("203.0.113.7"), { route: "cities", qlooCalls: 1 })));
    const allowed = decisions.filter((d) => d.kind === "allow").length;
    expect(allowed).toBeLessThanOrEqual(10);
    expect(allowed).toBeGreaterThan(0);
    const total = await charge(handle.db, { ipHash: ipHash("203.0.113.7", "2026-10-27", SALT), day: "2026-10-27" });
    expect(total.ip.qlooCalls).toBe(allowed);
  });

  it("a request that costs nothing (cache hit, stored slate) is allowed without touching the store", async () => {
    const broken = createGuard({
      db: () => {
        throw new Error("store must not be used");
      },
      config: config(),
      now: () => NOW,
    });
    expect(await broken(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 0 })).toMatchObject({ kind: "allow", qloo: "live", llm: "on" });
  });
});

describe("guard: global ceilings", () => {
  it("global Qloo ceiling reached: allowed as cache_only, reservation given back, per-IP allowance untouched", async () => {
    const events: GuardEvent[] = [];
    const guard = guardWith({ globalQlooCalls: 5, ipQlooCalls: 100 }, events);
    expect(await guard(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 5 })).toMatchObject({ kind: "allow", qloo: "live" });
    const second = await guard(asVisitor("203.0.113.9"), { route: "create", qlooCalls: 3 });
    expect(second).toMatchObject({ kind: "allow", qloo: "cache_only", llm: "on" });
    expect(events.map((e) => e.event)).toEqual(["budget_global_qloo"]);
    const row = await charge(handle.db, { ipHash: ipHash("203.0.113.9", "2026-10-27", SALT), day: "2026-10-27" });
    expect(row.ip.qlooCalls).toBe(0);
    expect(row.global.qlooCalls).toBe(5);
  });

  it("global LLM ceiling reached: deterministic_only, never an error, and Qloo is unaffected", async () => {
    const guard = guardWith({ globalLlmTokens: 1000 });
    expect(await guard(asVisitor("203.0.113.7"), { route: "explain", llmTokens: 900 })).toMatchObject({ kind: "allow", llm: "on" });
    const d = await guard(asVisitor("203.0.113.8"), { route: "explain", qlooCalls: 2, llmTokens: 400 });
    expect(d).toMatchObject({ kind: "allow", llm: "deterministic_only", qloo: "live" });
  });

  it("per-IP LLM limit reached: deterministic_only for that visitor only", async () => {
    const guard = guardWith({ ipLlmTokens: 500 });
    expect(await guard(asVisitor("203.0.113.7"), { route: "intake", llmTokens: 400 })).toMatchObject({ llm: "on" });
    expect(await guard(asVisitor("203.0.113.7"), { route: "intake", llmTokens: 400 })).toMatchObject({ kind: "allow", llm: "deterministic_only" });
    expect(await guard(asVisitor("203.0.113.8"), { route: "intake", llmTokens: 400 })).toMatchObject({ llm: "on" });
  });
});

describe("guard: fail closed", () => {
  it("denies metered work when the store throws, and when no salt is configured", async () => {
    const events: GuardEvent[] = [];
    const down = createGuard({
      db: () => {
        throw new Error("down");
      },
      config: config(),
      now: () => NOW,
      onEvent: (e) => events.push(e),
    });
    expect(await down(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 3 })).toMatchObject({ kind: "deny", reason: "store_unavailable" });
    const noSalt = createGuard({ db: () => handle.db, config: config({ salt: undefined }), now: () => NOW });
    expect(await noSalt(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 3 })).toMatchObject({ kind: "deny", reason: "store_unavailable" });
    expect(events).toEqual([{ event: "budget_store_error", route: "create" }]);
  });

  it("denies when the connection string is broken (nothing listens there)", async () => {
    const pool = new Pool({ connectionString: "postgresql://nobody:nothing@127.0.0.1:1/none", connectionTimeoutMillis: 800, max: 1 });
    pool.on("error", () => undefined);
    const guard = createGuard({ db: () => drizzle(pool) as unknown as Db, config: config(), now: () => NOW, timeoutMs: 3000 });
    const started = Date.now();
    const d = await guard(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 3 });
    expect(d).toMatchObject({ kind: "deny", reason: "store_unavailable" });
    expect(Date.now() - started).toBeLessThan(6000);
    await pool.end().catch(() => undefined);
  }, 20_000);

  it("gives up on a store that never answers (outbound timeout)", async () => {
    const hang = new Proxy({}, { get: () => () => new Promise(() => undefined) }) as unknown as Db;
    const guard = createGuard({ db: () => hang, config: config(), now: () => NOW, timeoutMs: 50 });
    expect(await guard(asVisitor("203.0.113.7"), { route: "create", qlooCalls: 1 })).toMatchObject({ kind: "deny", reason: "store_unavailable" });
  });
});

describe("guard: no raw IP is stored or logged", () => {
  const ips = ["203.0.113.77", "2001:db8:abcd:12::77"];
  const lines: string[] = [];
  beforeEach(() => {
    lines.length = 0;
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void lines.push(args.map(String).join(" ")));
    }
  });
  afterEach(() => vi.restoreAllMocks());

  it("rows hold only hashes and counters; deny and degrade log lines name a route and a reason", async () => {
    const guard = createGuard({ db: () => handle.db, config: config({ ipQlooCalls: 1, globalQlooCalls: 1_000_000, ipLlmTokens: 1 }), now: () => NOW });
    for (const ip of ips) {
      await guard(asVisitor(ip), { route: "create", qlooCalls: 1 });
      await guard(asVisitor(ip), { route: "create", qlooCalls: 1 }); // denied: ip_limit
      await guard(asVisitor(ip), { route: "intake", llmTokens: 5 }); // degraded
    }
    const rows = (await handle.db.execute(sql`select * from budgets`)) as unknown as { rows: Record<string, unknown>[] };
    expect(rows.rows.length).toBe(1 + ips.length);
    const dump = JSON.stringify(rows.rows) + lines.join("\n");
    for (const ip of ips) {
      expect(dump).not.toContain(ip);
      expect(dump).not.toContain(ip.split(":").slice(0, 3).join(":"));
    }
    expect(dump).not.toContain(SALT);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.includes("budget_deny") && l.includes("ip_limit"))).toBe(true);
    expect(lines.some((l) => l.includes("budget_llm_degraded"))).toBe(true);
    for (const r of rows.rows) {
      const key = String(r["ip_hash"]);
      expect(key === "global" || /^[0-9a-f]{64}$/.test(key)).toBe(true);
    }
  });
});
