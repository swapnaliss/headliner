import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { setRuntimeForTests } from "../src/config";
import { confirmRun, createSlate } from "../src/pipeline/createSlate";
import { SlateView } from "../src/ui/SlateView";
import RootLayout from "../app/layout";
import { fakeTransport, FIXTURE_DIR, fixtureTransport, ROOM, runtimeWith } from "./helpers";

afterEach(() => setRuntimeForTests(undefined));

const IMG = "<img src=x onerror=alert(1)>";
const FILTER = "Act &filter.type=urn:entity:place";

async function recorded() {
  const out = await createSlate(ROOM, runtimeWith(fixtureTransport()));
  if (out.status !== "done") throw new Error("expected done");
  return out;
}

describe("the shared slate page renders", () => {
  it("hostile entity names as literal text, not elements or query text", async () => {
    const out = await recorded();
    const slate = structuredClone(out.slate);
    const [a, b] = slate.results;
    const crowd0 = slate.room.crowdActs[0];
    if (!a || !b || !crowd0) throw new Error("expected results");
    a.act.name = IMG;
    b.act.name = FILTER;
    slate.room.crowdActs[0] = { ...crowd0, name: IMG };
    const html = renderToStaticMarkup(<SlateView slate={slate} shared />);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&amp;filter.type=urn:entity:place");
    // Names never become links: no href carries the name text.
    expect(html).not.toMatch(/href="[^"]*filter\.type/);
  });

  it("inside the root layout, the banner and the shared line, with no share or change-room controls", async () => {
    const out = await recorded();
    const html = renderToStaticMarkup(
      <RootLayout>
        <SlateView slate={out.slate} shared />
      </RootLayout>,
    );
    expect(html).toContain("aggregate affinity, not a ticket forecast");
    expect(html).toMatch(/Shared slate, created .+\. Kept until .+\./);
    expect(html).toContain("Make your own slate");
    expect(html).not.toContain("Copy link");
    expect(html).not.toContain("Change room");
    expect(html).toContain(`href="/s/${out.id}/act/`);
  });

  it("the owner page shows the Copy link control and the demo-mode note", async () => {
    const out = await recorded();
    const html = renderToStaticMarkup(<SlateView slate={out.slate} ephemeral />);
    expect(html).toContain("Share this slate");
    expect(html).toContain("Copy link");
    expect(html).toContain("in memory only");
    expect(html).toContain("Change room");
  });
});

describe("typed text is not stored in a shareable slate", () => {
  it("an unmatched hostile name that is skipped leaves no trace", async () => {
    const rt = runtimeWith(fixtureTransport());
    const hostile = `${IMG} &filter.type=urn:entity:place`;
    const waiting = await createSlate({ ...ROOM, candidateActs: [...ROOM.candidateActs, hostile] }, rt);
    if (waiting.status !== "awaiting_confirmation") throw new Error("expected awaiting");
    const done = await confirmRun(waiting.runId, [{ actInput: hostile, entityId: "skip" }], rt);
    if (done.status !== "done") throw new Error("expected done");
    const stored = JSON.stringify(await rt.store.get(done.id));
    expect(stored).not.toContain("onerror");
    expect(stored).not.toContain("&filter.type=urn:entity:place");
    expect(stored).not.toContain("<img");
  });

  it("a hostile typed name that Qloo resolves is replaced by the resolved name in the stored evidence", async () => {
    const real = fixtureTransport();
    const hostile = `${IMG} &filter.type=urn:entity:place`;
    const bjork = (JSON.parse(readFileSync(resolve(FIXTURE_DIR, "search--bjork.json"), "utf8")) as { body: unknown }).body;
    const transport = fakeTransport(async (req) => (req.endpoint === "/search" && req.params.get("query") === hostile ? { status: 200, body: bjork } : real.get(req)));
    const rt = runtimeWith(transport);
    const waiting = await createSlate({ ...ROOM, candidateActs: ["Khruangbin", "Radiohead", hostile] }, rt);
    if (waiting.status !== "awaiting_confirmation") throw new Error("expected awaiting");
    const picked = waiting.matches.find((m) => m.actInput === hostile)?.candidates[0];
    expect(picked?.name).toBe("Björk");
    const done = await confirmRun(waiting.runId, [{ actInput: hostile, entityId: picked?.entityId ?? "" }], rt);
    if (done.status !== "done") throw new Error("expected done");
    const stored = JSON.stringify(await rt.store.get(done.id));
    expect(stored).not.toContain("onerror");
    expect(stored).not.toContain("&filter.type=urn:entity:place");
    expect(stored).toContain("Björk");
    const evidence = done.slate.results.find((r) => r.act.name === "Björk")?.evidence.find((e) => e.endpoint === "/search");
    expect(evidence?.redactedParams["query"]).toBe("Björk");
  });
});
