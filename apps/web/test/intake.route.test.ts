import { PGlite } from "@electric-sql/pglite";
import { createIntakeReplay, loadIntakeTraces, type LlmProvider } from "@headliner/agent";
import type { Db } from "@headliner/slates";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { POST } from "../app/api/intake/route";
import { liveLlmBudget } from "../src/budget";
import { llmModel, setRuntimeForTests, type IntakeEnv } from "../src/config";
import { fixtureTransport, runtimeWith } from "./helpers";

const TRACES = fileURLToPath(new URL("../../../fixtures/agent/intake", import.meta.url));
const MIGRATIONS = fileURLToPath(new URL("../../../packages/slates/drizzle", import.meta.url));
const SENTENCE = "200-cap venue in Leipzig, our regulars love Khruangbin and Bonobo";

const replay = createIntakeReplay(loadIntakeTraces(TRACES));
const recorded: IntakeEnv = { source: "recorded", providerFor: (t, c) => replay.providerFor(t, c) };

const asPost = (body: unknown): Request =>
  new Request("http://localhost/api/intake", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });

afterEach(() => setRuntimeForTests(undefined));

describe("POST /api/intake in fixtures mode (no key, no database, no model)", () => {
  it("returns a schema-valid room for the recorded sentence", async () => {
    setRuntimeForTests({ ...runtimeWith(fixtureTransport()), intake: recorded });
    const res = await POST(asPost({ text: SENTENCE }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; room: { city: string; crowdActs: string[] }; steps: number; source: string };
    expect(body).toMatchObject({ status: "room", source: "recorded", room: { city: "Leipzig" } });
    expect(body.room.crowdActs.length).toBeLessThanOrEqual(6);
    expect(body.steps).toBeLessThanOrEqual(3);
  });

  it("a sentence with no recording is deterministic and the form stays usable", async () => {
    setRuntimeForTests({ ...runtimeWith(fixtureTransport()), intake: recorded });
    const body = (await (await POST(asPost({ text: "an unrecorded sentence about a venue" }))).json()) as { status: string; mode: string };
    expect(body).toMatchObject({ status: "deterministic", mode: "deterministic" });
  });

  it("with no model configured at all the answer is deterministic", async () => {
    setRuntimeForTests(runtimeWith(fixtureTransport()));
    expect(await (await POST(asPost({ text: SENTENCE }))).json()).toMatchObject({ status: "deterministic", reason: "llm_unavailable" });
  });

  it.each([
    ["501 characters", { text: "a".repeat(501) }],
    ["a control character", { text: "Leipzig \u0000 Khruangbin" }],
    ["an empty string", { text: "" }],
    ["an unknown field", { text: SENTENCE, extra: 1 }],
    ["a missing text", {}],
    ["a body that is not JSON", "{not json"],
    ["an oversized body", { text: SENTENCE, pad: "x".repeat(5000) }],
  ])("rejects %s with 400 before any model call", async (_label, body) => {
    let calls = 0;
    const provider: LlmProvider = { model: "x", complete: async () => ((calls += 1), Promise.reject(new Error("must not be called"))) };
    setRuntimeForTests({ ...runtimeWith(fixtureTransport()), intake: { source: "model", providerFor: () => provider } });
    const res = await POST(asPost(body));
    expect(res.status).toBe(400);
    expect(calls).toBe(0);
    expect(JSON.stringify(await res.json())).not.toContain("aaaa");
  });
});

describe("llmModel", () => {
  it("defaults to gpt-5-nano and accepts a plain model id from LLM_MODEL", () => {
    expect(llmModel({})).toBe("gpt-5-nano");
    expect(llmModel({ LLM_MODEL: "gpt-6-luna" })).toBe("gpt-6-luna");
    expect(llmModel({ LLM_MODEL: "bad model; drop" })).toBe("gpt-5-nano");
  });
});

describe("liveLlmBudget (the M2-05 guard, llmTokens)", () => {
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

  const req = new Request("http://localhost/api/intake", { method: "POST", headers: { "x-forwarded-for": "203.0.113.50" } });

  it("reserves per turn, settles the real usage, and returns null at the ceiling", async () => {
    const budget = liveLlmBudget(db, { BUDGET_SALT: "intake-test-salt", BUDGET_IP_LLM_TOKENS: "2000" })(req);
    const first = await budget.reserve(1500);
    expect(first).not.toBeNull();
    await first?.settle(200); // 200 used, 1300 given back
    const second = await budget.reserve(1500); // 200 + 1500 <= 2000
    expect(second).not.toBeNull();
    const third = await budget.reserve(1500); // 1700 + 1500 > 2000: ceiling, nothing reserved
    expect(third).toBeNull();
  });

  it("fails closed (no model call) when the budget has no salt", async () => {
    const budget = liveLlmBudget(db, {})(req);
    expect(await budget.reserve(100)).toBeNull();
  });
});
