import { describe, expect, it } from "vitest";
import { createQlooClient, type QlooClient } from "../src/client";
import { QlooShapeError } from "../src/errors";
import { CROWD, fakeTransport, fixtureBody, KHRUANGBIN } from "./helpers";

const A = CROWD[0] as string;

interface Case {
  name: string;
  call: (c: QlooClient) => Promise<unknown>;
  good: unknown;
  wrong: unknown[];
}

const cases: Case[] = [
  {
    name: "search",
    call: (c) => c.search("Apparat"),
    good: fixtureBody("search--apparat.json"),
    wrong: [{ results: [{ name: "Apparat" }] }, { results: "none" }, { items: [] }, [], null, "<html>"],
  },
  {
    name: "recommend",
    call: (c) => c.recommend([A]),
    good: fixtureBody("insights--apparat.json"),
    wrong: [{ success: true, results: {} }, { success: true, results: { entities: [{ name: "x" }] } }, { results: { entities: [] } }],
  },
  {
    name: "compareAudiences",
    call: (c) => c.compareAudiences([A], [KHRUANGBIN]),
    good: fixtureBody("compare--single-apparat-vs-khruangbin.json"),
    wrong: [{ results: {} }, { results: { tags: [{ tag_id: "t", name: "n", query: { score: 7 } }] } }, { results: { tags: [{ name: "n", query: { score: 0.5 } }] } }],
  },
  {
    name: "whereIsPopular",
    call: (c) => c.whereIsPopular(A, "Berlin"),
    good: fixtureBody("heatmap--apparat-berlin.json"),
    wrong: [
      { success: true, results: {} },
      { success: true, results: { heatmap: [{ location: {}, query: {} }] } },
      { success: true, results: { heatmap: [{ query: { affinity: 1, affinity_rank: 0.5, popularity: 1 } }] } },
    ],
  },
  {
    name: "trending",
    call: (c) => c.trending([A]),
    good: fixtureBody("trending--artist-signal-apparat.json"),
    wrong: [{ success: true, results: [] }, { success: true, results: { trending: [{ name: "x" }] } }, {}],
  },
];

describe.each(cases)("$name: response shape assertion", ({ call, good, wrong }) => {
  it("accepts the recorded real response", async () => {
    const c = createQlooClient({ transport: fakeTransport(() => ({ status: 200, body: good })) });
    await expect(call(c)).resolves.toBeDefined();
  });

  it.each(wrong.map((w, i) => [i, w] as const))("a 200 with the wrong shape (#%i) raises QlooShapeError", async (_i, body) => {
    const t = fakeTransport(() => ({ status: 200, body }));
    const c = createQlooClient({ transport: t });
    const err = await call(c).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(QlooShapeError);
    expect((err as QlooShapeError).kind).toBe("shape");
    expect(t.calls.length).toBe(1); // a shape error is not retried
  });
});

describe("shape errors are not cached", () => {
  it("a later good response is fetched fresh", async () => {
    let n = 0;
    const t = fakeTransport(() => (++n === 1 ? { status: 200, body: { results: "x" } } : { status: 200, body: fixtureBody("search--apparat.json") }));
    const c = createQlooClient({ transport: t });
    await expect(c.search("Apparat")).rejects.toBeInstanceOf(QlooShapeError);
    await expect(c.search("Apparat")).resolves.toMatchObject({ cached: false });
    expect(t.calls.length).toBe(2);
  });
});

describe("the parameter-ignoring pitfall", () => {
  it("the recorded invalid-parameter response still passes (Qloo ignores bad params and returns 200), which is why shapes are asserted", () => {
    const body = fixtureBody("invalid--bogus-parameter.json") as { results: { entities: unknown[] } };
    expect(Array.isArray(body.results.entities)).toBe(true);
  });
});
