import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../../apps/web/app/api/slates/route";
import { setRuntimeForTests } from "../../apps/web/src/config";
import { fixtureTransport, post, ROOM, runtimeWith } from "../../apps/web/test/helpers";

/**
 * M4-03 scope 7 (spot checks, no new feature). Hostile names never reach Qloo as extra parameters and are never
 * echoed in an error. Rendering as plain text: apps/web/test/ui/confirm.test.tsx. Input caps (13 candidates, 7 crowd
 * acts, 6 cities, 81 characters, 20 KB body): apps/web/test/budget.route.test.ts. Per-IP limit: same file, and the
 * intake route's deterministic answer: apps/web/test/intake.route.test.ts.
 */

afterEach(() => setRuntimeForTests(undefined));

describe("hostile entity names", () => {
  it.each(["Evil&filter.type=urn:entity:place", "x&take=999&bogus=1", "<script>alert(1)</script>"])("%s reaches Qloo only as one encoded query value", async (name) => {
    const transport = fixtureTransport();
    setRuntimeForTests(runtimeWith(transport));
    await POST(post({ ...ROOM, candidateActs: [name, ...ROOM.candidateActs.slice(0, 3)] }));
    const searches = transport.calls.filter((c) => c.endpoint === "/search");
    const hostile = searches.find((c) => c.params.get("query") === name);
    expect(hostile).toBeDefined(); // the whole string is the value of `query`
    for (const call of transport.calls) {
      expect([...call.params.keys()].filter((k) => k === "bogus")).toEqual([]);
      if (call.endpoint === "/search") expect(call.params.get("filter.type")).toBeNull();
      expect(call.params.get("take")).not.toBe("999");
    }
  });

  it("a 10,000-character name is rejected with 400, no Qloo call, and is not echoed", async () => {
    const transport = fixtureTransport();
    setRuntimeForTests(runtimeWith(transport));
    const long = "A".repeat(10_000);
    const res = await POST(post({ ...ROOM, candidateActs: [long, "b", "c"] }));
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(text).not.toContain("AAAAAAAAAA");
    expect(text.length).toBeLessThan(300);
    expect(transport.calls.length).toBe(0);
  });

  it("a name that is markup is not echoed by the error body", async () => {
    setRuntimeForTests(runtimeWith(fixtureTransport()));
    const res = await POST(post({ ...ROOM, city: "<script>alert(1)</script>".repeat(5) }));
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(text).not.toContain("<script>");
  });
});
