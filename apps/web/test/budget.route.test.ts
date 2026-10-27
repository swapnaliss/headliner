import { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import { charge, ipHash, utcDay } from "@headliner/budgets";
import { createQlooClient, InMemoryCacheStore } from "@headliner/qloo";
import type { Slate } from "@headliner/core";
import type { Db } from "@headliner/slates";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { POST as confirmRoute } from "../app/api/slates/[id]/confirm/route";
import { POST as citiesRoute } from "../app/api/slates/[id]/acts/[actId]/cities/route";
import { POST as createRoute } from "../app/api/slates/route";
import { liveBudgetHook } from "../src/budget";
import { buildRuntime, setRuntimeForTests, type Runtime } from "../src/config";
import { ApiError } from "../src/errors";
import { counting, fixtureTransport, post, ROOM, runtimeWith, type CountingTransport } from "./helpers";

const NOW = new Date("2026-10-26T12:00:00.000Z"); // runtimeWith's clock: 12 h to the next UTC midnight
const SALT = "route-test-salt-value";
const MIGRATIONS = fileURLToPath(new URL("../../../packages/slates/drizzle", import.meta.url));
const IP_A = "203.0.113.10";
const IP_B = "203.0.113.11";

let pg: PGlite;
let db: Db;
beforeAll(async () => {
  pg = new PGlite();
  const d = drizzlePglite(pg);
  await migrate(d, { migrationsFolder: MIGRATIONS });
  db = d as unknown as Db;
});
afterAll(async () => {
  await pg.close();
});

let logs: string[];
beforeEach(async () => {
  await db.execute(`delete from budgets` as never);
  logs = [];
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logs.push(args.map(String).join(" ")));
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  setRuntimeForTests(undefined);
});

const asIp = (ip: string, body: unknown = ROOM): Request =>
  new Request("http://localhost/api/slates", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });

interface Rig {
  readonly rt: Runtime;
  /** Transport behind the live client: counts every live Qloo call. */
  readonly transport: CountingTransport;
  /** Transport behind the cache-only client: must never be reached. */
  readonly refused: CountingTransport;
}

function rig(env: Record<string, string | undefined>, over: Partial<Runtime> = {}, mode: "fixtures" | "live" = "fixtures", database: Db = db): Rig {
  const transport = fixtureTransport();
  const refused = counting({ get: () => Promise.reject(new Error("must not be called")) });
  const cache = new InMemoryCacheStore();
  const base = runtimeWith(transport, mode);
  const options = { cache, sleep: async () => undefined, jitterMs: () => 0 } as const;
  const rt: Runtime = {
    ...base,
    client: createQlooClient({ transport, ...options }),
    cacheOnlyClient: createQlooClient({ transport: refused, ...options }),
    budget: liveBudgetHook(database, { BUDGET_SALT: SALT, ...env }, () => NOW),
    ...over,
  };
  setRuntimeForTests(rt);
  return { rt, transport, refused };
}

const errorOf = async (res: Response): Promise<{ code: string; message: string }> => ((await res.json()) as { error: { code: string; message: string } }).error;

describe("per-IP limit on the create route", () => {
  it("denies the visitor over the limit with 429, Retry-After and a generic message; a different IP is unaffected", async () => {
    const { transport } = rig({ BUDGET_IP_QLOO_CALLS: "20" });
    expect((await createRoute(asIp(IP_A))).status).toBe(200);
    const live = transport.calls.length;
    expect(live).toBe(14); // 10 searches + 4 compares, all inside the 14 planned

    const denied = await createRoute(asIp(IP_A));
    expect(denied.status).toBe(429);
    expect(denied.headers.get("retry-after")).toBe(String(12 * 3600));
    const error = await errorOf(denied);
    expect(error.code).toBe("demo_limit_reached");
    expect(error.message).toMatch(/daily demo limit reached/i);
    expect(JSON.stringify(error)).not.toMatch(/qloo|postgres|neon|budgets|203\.0\.113/i);
    expect(transport.calls.length).toBe(live); // refused before any Qloo call

    const other = await createRoute(asIp(IP_B));
    expect(other.status).toBe(200); // its names are cached now; only the unrecorded act (a failed call is never cached) is asked again
    expect(transport.calls.length).toBe(live + 1);
  });

  it("records the calls really made, not the plan: cache hits cost 0", async () => {
    rig({ BUDGET_IP_QLOO_CALLS: "100" });
    await createRoute(asIp(IP_A));
    await createRoute(asIp(IP_A)); // cached, except the unrecorded act's compare: a failed call is not cached, so it is asked (and counted) again
    const key = ipHash(IP_A, utcDay(NOW), SALT);
    const totals = await charge(db, { ipHash: key, day: utcDay(NOW) });
    expect(totals.ip.qlooCalls).toBe(15); // 14 for the cold room + 1, not 14 + 14
  });

  it("no raw IP reaches the database or the logs", async () => {
    rig({ BUDGET_IP_QLOO_CALLS: "14" });
    await createRoute(asIp(IP_A));
    await createRoute(asIp(IP_A));
    const rows = JSON.stringify(await db.execute(`select * from budgets` as never));
    expect(rows).not.toContain(IP_A);
    expect(logs.join("\n")).not.toContain(IP_A);
    expect(logs.some((l) => l.includes("budget_deny"))).toBe(true);
  });
});

describe("global ceiling", () => {
  it("Qloo ceiling reached: the same room is served from the cache with no live call", async () => {
    const { transport, refused } = rig({ BUDGET_GLOBAL_QLOO_CALLS: "14" });
    expect((await createRoute(asIp(IP_A))).status).toBe(200); // warms the cache, uses the 14
    const live = transport.calls.length;
    const res = await createRoute(asIp(IP_B));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe("done");
    expect(transport.calls.length).toBe(live);
    expect(refused.calls.length).toBeLessThanOrEqual(1); // only the unrecorded act's compare is asked of the cache-only client, and refused
  });

  it("Qloo ceiling reached and nothing cached: a daily-limit answer, not a provider error, and no live call", async () => {
    const { transport, refused } = rig({ BUDGET_GLOBAL_QLOO_CALLS: "1" }, {}, "live");
    await charge(db, { ipHash: ipHash(IP_A, utcDay(NOW), SALT), day: utcDay(NOW), qlooCalls: 5 });
    const res = await createRoute(asIp(IP_B));
    expect(res.status).toBe(429);
    expect((await errorOf(res)).code).toBe("demo_limit_reached");
    expect(res.headers.get("retry-after")).toBe(String(12 * 3600));
    expect(transport.calls.length).toBe(0);
    expect(refused.calls.length).toBeGreaterThan(0); // the cache-only client tried, and was refused
  });
});

describe("budget store unreachable: fail closed, stored slates still load", () => {
  it("denies metered work on a broken connection string and still reads a saved slate", async () => {
    const good = rig({});
    const made = await createRoute(asIp(IP_A));
    const { id } = (await made.json()) as { id: string };

    const pool = new Pool({ connectionString: "postgresql://nobody:nothing@127.0.0.1:1/none", connectionTimeoutMillis: 800, max: 1 });
    pool.on("error", () => undefined);
    const broken = { ...good.rt, budget: liveBudgetHook(drizzleNeon(pool) as unknown as Db, { BUDGET_SALT: SALT }, () => NOW) };
    setRuntimeForTests(broken);
    const before = good.transport.calls.length;

    const res = await createRoute(asIp(IP_A, { ...ROOM, city: "Leipzig" }));
    expect(res.status).toBe(429);
    expect((await errorOf(res)).code).toBe("demo_limit_reached");
    expect(good.transport.calls.length).toBe(before);

    const cached = (await broken.store.get(id)) as Slate | null;
    expect(cached?.id).toBe(id);
    expect(JSON.stringify(logs)).not.toMatch(/nobody|nothing@|127\.0\.0\.1/);
    await pool.end().catch(() => undefined);
  }, 30_000);

  it("a malformed limit variable fails closed instead of running unmetered", async () => {
    const { transport } = rig({ BUDGET_IP_QLOO_CALLS: "lots" });
    const res = await createRoute(asIp(IP_A));
    expect(res.status).toBe(429);
    expect(transport.calls.length).toBe(0);
  });
});

describe("confirm and cities routes", () => {
  it("the confirm route asks the budget only for a known run, with one planned call per candidate", async () => {
    const seen: { route: string; plannedCalls: number }[] = [];
    const rigged = rig({}, {
      budget: async ({ route, plannedCalls }) => {
        seen.push({ route, plannedCalls });
        throw new ApiError("demo_limit_reached", undefined, 600);
      },
    });
    const row = (role: "crowd" | "candidate", actInput: string, state: "none" | "exact") => ({ role, actInput, state, candidates: [], evidence: null });
    await rigged.rt.runs.save({
      id: "R".repeat(21),
      request: { city: "Berlin", crowdActs: ROOM.crowdActs, candidateActs: ["Khruangbin", "Radiohead", "Nonexistent Band XYZ"] },
      matches: [row("candidate", "A", "none"), row("candidate", "B", "exact"), row("crowd", "C", "exact")],
      createdAt: NOW.toISOString(),
      stale: false,
    });
    const confirm = (id: string): Promise<Response> =>
      confirmRoute(new Request(`http://localhost/api/slates/${id}/confirm`, { method: "POST", body: JSON.stringify({ choices: [] }) }), { params: Promise.resolve({ id }) });

    expect((await confirm("U".repeat(21))).status).toBe(404);
    expect(seen).toEqual([]); // an unknown run costs nothing

    const res = await confirm("R".repeat(21));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("600");
    expect((await errorOf(res)).code).toBe("demo_limit_reached");
    expect(seen).toEqual([{ route: "confirm", plannedCalls: 2 }]);
  });

  it("the cities route is metered per city: over the limit it answers 429 with Retry-After and makes no heatmap call", async () => {
    const { transport } = rig({ BUDGET_IP_QLOO_CALLS: "25" });
    const made = (await (await createRoute(asIp(IP_A))).json()) as { slate: Slate };
    const actId = made.slate.results.find((r) => r.act.name === "Reality Club")?.act.qlooEntityId as string;
    const call = (cities: string[], ip: string): Promise<Response> =>
      citiesRoute(new Request("http://localhost/x", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify({ cities }) }), {
        params: Promise.resolve({ id: made.slate.id, actId }),
      });
    expect((await call(["Berlin", "London", "Leipzig", "Jakarta", "Tromsø"], IP_A)).status).toBe(200); // 14 + 5
    expect((await call(["Paris", "Vienna", "Madrid", "Rome", "Oslo"], IP_A)).status).toBe(200); // 19 + 5: unrecorded, each still a live attempt
    const calls = transport.calls.length;
    const denied = await call(["Lisbon", "Dublin", "Athens", "Prague", "Warsaw"], IP_A); // 24 + 5 > 25
    expect(denied.status).toBe(429);
    expect(denied.headers.get("retry-after")).toBe(String(12 * 3600));
    expect((await errorOf(denied)).code).toBe("demo_limit_reached");
    expect(transport.calls.length).toBe(calls);
    expect((await call(["Berlin"], IP_B)).status).toBe(200); // another visitor is unaffected
  });
});

describe("zero-key demo mode", () => {
  it("DEMO_MODE=fixtures builds a runtime with no budget, no database and no cache-only client", () => {
    const rt = buildRuntime({ DEMO_MODE: "fixtures" });
    expect(rt.mode).toBe("fixtures");
    expect(rt.budget).toBeUndefined();
    expect(rt.cacheOnlyClient).toBeUndefined();
  });

  it("a fixtures-mode create succeeds with no budget configured", async () => {
    setRuntimeForTests(runtimeWith(fixtureTransport()));
    expect((await createRoute(post(ROOM))).status).toBe(200);
  });
});

describe("input caps at the edge (table-driven)", () => {
  const names = (n: number, prefix: string): string[] => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);
  const base = { city: "Berlin", crowdActs: names(6, "Crowd"), candidateActs: names(12, "Cand") };
  const cases: { name: string; body: unknown | string }[] = [
    { name: "13th candidate", body: { ...base, candidateActs: names(13, "Cand") } },
    { name: "7th crowd act", body: { ...base, crowdActs: names(7, "Crowd") } },
    { name: "81-character act name", body: { ...base, candidateActs: ["x".repeat(81), "b", "c"] } },
    { name: "81-character city", body: { ...base, city: "c".repeat(81) } },
    { name: "20 KB body", body: JSON.stringify({ ...base, padding: "p".repeat(20 * 1024) }) },
    { name: "control character in a name", body: { ...base, candidateActs: ["bad\u0007name", "b", "c"] } },
    { name: "line separator in a name", body: { ...base, crowdActs: ["a b", "b", "c"] } },
  ];

  it.each(cases)("$name is rejected by the schema with no Qloo call and no budget spent", async ({ body }) => {
    const spent = vi.fn();
    const transport = fixtureTransport();
    setRuntimeForTests({ ...runtimeWith(transport), budget: spent });
    const res = await createRoute(post(body));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("invalid_input");
    expect(transport.calls.length).toBe(0);
    expect(spent).not.toHaveBeenCalled();
  });

  it("a 6th city is rejected by the cities route with no heatmap call", async () => {
    const { transport } = rig({});
    const made = (await (await createRoute(asIp(IP_A))).json()) as { slate: Slate };
    const actId = made.slate.results[0]?.act.qlooEntityId as string;
    const before = transport.calls.length;
    const res = await citiesRoute(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ cities: names(6, "City") }) }), {
      params: Promise.resolve({ id: made.slate.id, actId }),
    });
    expect(res.status).toBe(400);
    expect(transport.calls.length).toBe(before);
  });
});
