import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createQlooClient, FixtureTransport, InMemoryCacheStore } from "@headliner/qloo";
import { describe, expect, it } from "vitest";
import { IntakeResultSchema } from "./schema";
import { runIntake } from "./loop";
import { createIntakeReplay, loadIntakeTraces } from "./replay";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const TRACES = join(ROOT, "fixtures/agent/intake");
const qloo = () => createQlooClient({ transport: new FixtureTransport(join(ROOT, "fixtures/qloo")), cache: new InMemoryCacheStore() });

describe("recorded intake traces (fixtures/agent/intake)", () => {
  const traces = loadIntakeTraces(TRACES);
  const replay = createIntakeReplay(traces);

  it("there are 4 traces", () => {
    expect(traces).toHaveLength(4);
    expect(replay.size).toBe(4);
  });

  it("contain no key-shaped strings, headers or auth text", () => {
    for (const f of readdirSync(TRACES)) {
      const text = readFileSync(join(TRACES, f), "utf8");
      expect(text).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
      expect(text.toLowerCase()).not.toMatch(/x-api-key|authorization|bearer |api[_-]?key/);
    }
  });

  it("replay every trace to the recorded outcome, with no key and no network", async () => {
    for (const t of traces) {
      const out = await runIntake(t.input, { provider: replay.providerFor(t.input, t.clarified), qloo: qloo(), clarified: t.clarified, source: "recorded" });
      expect(out.status).toBe(t.outcome.status);
      if (out.status === "room") expect(IntakeResultSchema.safeParse({ room: out.room, cities: out.cities, steps: out.steps }).success).toBe(true);
    }
  });

  it("a sentence naming a city and 3 acts gives a schema-valid room in fixtures mode", async () => {
    const input = "200-cap venue in Leipzig, our regulars love Khruangbin and Bonobo";
    const out = await runIntake(input, { provider: replay.providerFor(input, false), qloo: qloo(), source: "recorded" });
    expect(out).toMatchObject({ status: "room", source: "recorded", room: { city: "Leipzig" } });
  });

  it("the under-specified trace yields one question; the clarified follow-up yields a room", async () => {
    const a = traces.find((t) => t.outcome.status === "clarification");
    expect(a).toBeDefined();
    const out = await runIntake(a?.input, { provider: replay.providerFor(a?.input, false), qloo: qloo(), source: "recorded" });
    expect(out.status).toBe("clarification");
    const b = traces.find((t) => t.clarified);
    const out2 = await runIntake(b?.input, { provider: replay.providerFor(b?.input, true), qloo: qloo(), clarified: true, source: "recorded" });
    expect(out2.status).toBe("room");
  });

  it("a sentence with no recording is deterministic (the form stays usable), never invented", async () => {
    const input = "a brand new sentence nobody recorded";
    const out = await runIntake(input, { provider: replay.providerFor(input, false), qloo: qloo(), source: "recorded" });
    expect(out).toMatchObject({ status: "deterministic", reason: "no_recording" });
  });
});
