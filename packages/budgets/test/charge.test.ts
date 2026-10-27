import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { charge, GLOBAL_KEY } from "../src/charge";
import { fakeHash, openMigratedTestBranch, openPglite, testDatabaseUrl, type Handle } from "./helpers";

// A far-future day per run, so rows never collide with real days on a branch copied from production,
// and cleanup deletes exactly this day.
const DAY = `2099-${String(1 + (Date.now() % 12)).padStart(2, "0")}-${String(1 + (Math.floor(Date.now() / 1000) % 28)).padStart(2, "0")}`;

const TEST_URL = testDatabaseUrl();

interface Target {
  readonly name: string;
  readonly open: () => Promise<Handle>;
  readonly run: boolean;
}

const targets: Target[] = [
  { name: "PGlite", open: openPglite, run: true },
  { name: "TEST_DATABASE_URL (Neon test branch)", open: () => openMigratedTestBranch(TEST_URL as string), run: TEST_URL !== undefined },
];

describe.each(targets)("charge on $name", (target) => {
  let handle: Handle;
  const skip = !target.run;

  beforeAll(async () => {
    if (!skip) handle = await target.open();
  });
  afterAll(async () => {
    if (skip) return;
    await handle.db.execute(sql`delete from budgets where day = ${DAY}::date`);
    await handle.close();
  });

  it.skipIf(skip)("50 parallel charges of 1 record exactly 50, never fewer", async () => {
    const key = fakeHash("concurrency-" + target.name);
    const results = await Promise.all(Array.from({ length: 50 }, () => charge(handle.db, { ipHash: key, day: DAY, qlooCalls: 1 })));
    // Every call saw a distinct running total: no two requests read the same value and wrote it back.
    expect(new Set(results.map((r) => r.ip.qlooCalls)).size).toBe(50);
    expect(Math.max(...results.map((r) => r.ip.qlooCalls))).toBe(50);
    const rows = (await handle.db.execute(sql`select qloo_calls, llm_tokens from budgets where ip_hash = ${key} and day = ${DAY}::date`)) as unknown as {
      rows: { qloo_calls: number; llm_tokens: number }[];
    };
    expect(rows.rows).toEqual([{ qloo_calls: 50, llm_tokens: 0 }]);
  }, 60_000);

  it.skipIf(skip)("keeps the per-visitor rows apart and the global row equal to their sum", async () => {
    const a = fakeHash("visitor-a" + target.name);
    const b = fakeHash("visitor-b" + target.name);
    const before = (await charge(handle.db, { ipHash: a, day: DAY, qlooCalls: 0 })).global.qlooCalls;
    await Promise.all([
      ...Array.from({ length: 10 }, () => charge(handle.db, { ipHash: a, day: DAY, qlooCalls: 2, llmTokens: 100 })),
      ...Array.from({ length: 5 }, () => charge(handle.db, { ipHash: b, day: DAY, qlooCalls: 3 })),
    ]);
    const last = await charge(handle.db, { ipHash: a, day: DAY });
    expect(last.ip).toEqual({ qlooCalls: 20, llmTokens: 1000 });
    expect(last.global.qlooCalls - before).toBe(35);
    const other = await charge(handle.db, { ipHash: b, day: DAY });
    expect(other.ip).toEqual({ qlooCalls: 15, llmTokens: 0 });
  }, 60_000);

  it.skipIf(skip)("a negative charge gives an unused reservation back and totals never go below 0", async () => {
    const key = fakeHash("refund-" + target.name);
    await charge(handle.db, { ipHash: key, day: DAY, qlooCalls: 10, llmTokens: 50 });
    const back = await charge(handle.db, { ipHash: key, day: DAY, qlooCalls: -4, llmTokens: -50 });
    expect(back.ip).toEqual({ qlooCalls: 6, llmTokens: 0 });
    const floor = await charge(handle.db, { ipHash: key, day: DAY, qlooCalls: -100 });
    expect(floor.ip.qlooCalls).toBe(0);
  });

  it.skipIf(skip)("a new day starts from zero", async () => {
    const key = fakeHash("day-" + target.name);
    await charge(handle.db, { ipHash: key, day: DAY, qlooCalls: 7 });
    const next = "2098-01-01";
    try {
      const fresh = await charge(handle.db, { ipHash: key, day: next, qlooCalls: 1 });
      expect(fresh.ip.qlooCalls).toBe(1);
    } finally {
      await handle.db.execute(sql`delete from budgets where day = ${next}::date`);
    }
  });

  it.skipIf(skip)("rejects a raw address, the reserved global key and a malformed day before any query", async () => {
    await expect(charge(handle.db, { ipHash: "203.0.113.7", day: DAY, qlooCalls: 1 })).rejects.toThrow();
    await expect(charge(handle.db, { ipHash: GLOBAL_KEY, day: DAY, qlooCalls: 1 })).rejects.toThrow();
    await expect(charge(handle.db, { ipHash: fakeHash("x"), day: "tomorrow", qlooCalls: 1 })).rejects.toThrow();
    await expect(charge(handle.db, { ipHash: fakeHash("x"), day: DAY, qlooCalls: 1.5 })).rejects.toThrow();
  });
});
