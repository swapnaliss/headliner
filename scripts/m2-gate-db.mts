// M2-GATE helper for the THROWAWAY test database only (TEST_DATABASE_URL, prerequisite P-14).
// It uses TEST_DATABASE_URL only and never reads DATABASE_URL (production).
//
//   reset               truncate budgets (and runs, slates) so a phase starts from zero
//   budgets             print the budgets rows: hash length, day, counters (no raw address can appear)
//   scan <text>...      count rows in budgets/slates/runs/qloo_cache whose text contains any given string
//   cachecount          count qloo_cache rows
//   guard               exercise the guard directly on the test database: LLM ceiling (deterministic_only),
//                       Qloo global ceiling (cache_only), store unreachable (deny store_unavailable)
//
// Run: scripts/m2-gate-abuse.sh loads the environment and calls this through tsx. Nothing here prints a key,
// a connection string or a raw address.
import { createGuard, ipHash, utcDay } from "../packages/budgets/src/index";
import { closeDb, getDb } from "../packages/slates/src/index";
import { sql } from "drizzle-orm";

const test = process.env["TEST_DATABASE_URL"];
if (!test) throw new Error("TEST_DATABASE_URL is not set");
// scripts/m2-gate-abuse.sh has already refused to run when TEST_DATABASE_URL equals DATABASE_URL.
const db = getDb({ DATABASE_URL: test });

const [, , cmd, ...args] = process.argv;
async function count(table: string, needle: string): Promise<number> {
  const rows = await db.execute(sql.raw(`select count(*)::int as n from ${table} t where t::text like '%' || '${needle.replace(/'/g, "''")}' || '%'`));
  return (rows.rows[0] as { n: number }).n;
}

try {
  if (cmd === "reset") {
    await db.execute(sql`truncate table budgets`);
    await db.execute(sql`delete from runs`);
    console.log("reset: budgets truncated, runs cleared");
  } else if (cmd === "budgets") {
    const rows = await db.execute(sql`select ip_hash, day::text as day, qloo_calls, llm_tokens from budgets order by day, ip_hash`);
    for (const r of rows.rows as { ip_hash: string; day: string; qloo_calls: number; llm_tokens: number }[]) {
      const shape = r.ip_hash === "global" ? "global" : `${r.ip_hash.length}-char ${/^[0-9a-f]+$/.test(r.ip_hash) ? "hex" : "NOT-HEX"} hash ${r.ip_hash.slice(0, 6)}..`;
      console.log(`budget row: ${shape} day=${r.day} qloo_calls=${r.qloo_calls} llm_tokens=${r.llm_tokens}`);
    }
    console.log(`rows: ${rows.rows.length}`);
  } else if (cmd === "scan") {
    for (const needle of args) {
      const found: Record<string, number> = {};
      for (const table of ["budgets", "slates", "runs", "qloo_cache"]) found[table] = await count(table, needle);
      console.log(`scan for ${JSON.stringify(needle)}: ${JSON.stringify(found)}`);
    }
  } else if (cmd === "cachecount") {
    const rows = await db.execute(sql`select count(*)::int as n from qloo_cache`);
    console.log(`qloo_cache rows: ${(rows.rows[0] as { n: number }).n}`);
  } else if (cmd === "guard") {
    const salt = "m2-gate-test-salt";
    const events: string[] = [];
    const base = { ipQlooCalls: 150, ipLlmTokens: 100, globalQlooCalls: 2000, globalLlmTokens: 100, salt };
    await db.execute(sql`delete from budgets where day = ${utcDay(new Date())}::date`);
    const guard = createGuard({ db: () => db, config: base, onEvent: (e) => events.push(`${e.event}:${e.route}${e.reason ? ":" + e.reason : ""}`) });
    const h = (ip: string) => new Headers({ "x-forwarded-for": ip });
    const a = await guard(h("203.0.113.50"), { route: "m2-gate-llm", llmTokens: 60 });
    const b = await guard(h("203.0.113.51"), { route: "m2-gate-llm", llmTokens: 60 }); // global 100 exceeded: 60 + 60
    const c = await guard(h("203.0.113.50"), { route: "m2-gate-llm", llmTokens: 60 }); // per-IP 100 exceeded as well
    const show = (d: Awaited<ReturnType<typeof guard>>) => (d.kind === "allow" ? `allow qloo=${d.qloo} llm=${d.llm}` : `deny ${d.reason}`);
    console.log(`LLM call 1 (60 of 100 tokens):  ${show(a)}`);
    console.log(`LLM call 2 (other IP, global 120 > 100): ${show(b)}`);
    console.log(`LLM call 3 (same IP, 120 > 100): ${show(c)}`);
    const g = createGuard({ db: () => db, config: { ...base, globalQlooCalls: 5, globalLlmTokens: 1_000_000, ipLlmTokens: 1_000_000 }, onEvent: (e) => events.push(`${e.event}:${e.route}`) });
    const d = await g(h("203.0.113.52"), { route: "m2-gate-qloo", qlooCalls: 9 });
    console.log(`Qloo global ceiling (9 planned, ceiling 5): ${show(d)}`);
    // The budget store is made unreachable by a db factory that throws (the real driver keeps one process-wide handle).
    const throwing = createGuard({ db: () => { throw new Error("store unreachable"); }, config: base, onEvent: (e) => events.push(`${e.event}:${e.route}`) });
    const e = await throwing(h("203.0.113.53"), { route: "m2-gate-store", qlooCalls: 1 });
    console.log(`Budget store unreachable: ${show(e)}`);
    console.log(`guard events (route and reason only): ${JSON.stringify(events)}`);
    const rows = await db.execute(sql`select ip_hash from budgets where day = ${utcDay(new Date())}::date`);
    const raw = (rows.rows as { ip_hash: string }[]).filter((r) => r.ip_hash.includes("203.0.113"));
    console.log(`budget rows today: ${rows.rows.length}; rows containing a raw test address: ${raw.length}; ip_hash helper sample length: ${ipHash("203.0.113.50", utcDay(new Date()), salt).length}`);
    await db.execute(sql`delete from budgets where day = ${utcDay(new Date())}::date`);
  } else {
    throw new Error("usage: reset | budgets | scan <text>... | cachecount | guard");
  }
} finally {
  await closeDb();
}
