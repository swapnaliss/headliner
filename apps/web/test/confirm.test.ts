import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { setRuntimeForTests } from "../src/config";
import { POST as confirmPost } from "../app/api/slates/[id]/confirm/route";
import { POST as createPost } from "../app/api/slates/route";
import { fakeTransport, FIXTURE_DIR, fixtureTransport, post, ROOM, runtimeWith } from "./helpers";

const isCompare = (endpoint: string): boolean => endpoint === "/v2/insights/compare";

type Hit = { name: string; entity_id: string; [k: string]: unknown };
/** The recorded Qloo response for the accented "Björk" search; a user typing "Bjork" gets this shape. */
const bjorkBody = (): { results: Hit[] } => (JSON.parse(readFileSync(resolve(FIXTURE_DIR, "search--bjork.json"), "utf8")) as { body: { results: Hit[] } }).body;

/** Fixture transport where the unaccented query "Bjork" is answered with the recorded Björk search body. */
function transportWithBjork(mutate?: (body: { results: Hit[] }) => void) {
  const real = fixtureTransport();
  const t = fakeTransport(async (req) => {
    if (req.endpoint === "/search" && req.params.get("query") === "Bjork") {
      const body = bjorkBody();
      mutate?.(body);
      return { status: 200, body };
    }
    return real.get(req);
  });
  return t;
}

const ROOM_WITH_BJORK = { ...ROOM, candidateActs: ["Khruangbin", "Radiohead", "Bjork"] };

interface Awaiting {
  status: "awaiting_confirmation";
  runId: string;
  room: { city: string; locationDisplay: string };
  matches: { role: string; actInput: string; state: string; candidates: { entityId: string; name: string; popularity: number; tags: string[] }[] }[];
}

async function start(body: unknown = ROOM_WITH_BJORK): Promise<Awaiting> {
  const res = await createPost(post(body));
  expect(res.status).toBe(200);
  const json = (await res.json()) as Awaiting;
  expect(json.status).toBe("awaiting_confirmation");
  return json;
}

function confirm(runId: string, body: unknown): Promise<Response> {
  const request = new Request(`http://localhost/api/slates/${runId}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return confirmPost(request, { params: Promise.resolve({ id: runId }) });
}

afterEach(() => setRuntimeForTests(undefined));

describe("ambiguous match blocks ranking until confirmed", () => {
  it("returns awaiting_confirmation with up to 5 candidates, makes zero compare calls, and confirm completes the run", async () => {
    const transport = transportWithBjork();
    const rt = runtimeWith(transport);
    setRuntimeForTests(rt);

    const waiting = await start();
    expect(waiting.runId).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(waiting.room).toEqual({ city: "Berlin", locationDisplay: "Berlin" });
    expect(waiting.matches).toHaveLength(9);
    const row = waiting.matches.find((m) => m.state === "ambiguous");
    expect(row).toMatchObject({ role: "candidate", actInput: "Bjork" });
    expect(row?.candidates.length).toBeGreaterThan(1);
    expect(row?.candidates.length).toBeLessThanOrEqual(5);
    expect(row?.candidates[0]).toMatchObject({ name: "Björk" });
    expect(row?.candidates.every((c) => c.tags.length <= 3)).toBe(true);
    expect(transport.calls.filter((c) => isCompare(c.endpoint))).toHaveLength(0);
    expect(rt.runs).toBeDefined();

    const picked = row?.candidates[0]?.entityId ?? "";
    const res = await confirm(waiting.runId, { choices: [{ actInput: "Bjork", entityId: picked }] });
    expect(res.status).toBe(200);
    const done = (await res.json()) as { status: string; id: string; slate: { results: { act: { name: string; matchConfidence: number }; caveats: { type: string }[] }[] } };
    expect(done.status).toBe("done");
    expect(transport.calls.filter((c) => isCompare(c.endpoint))).toHaveLength(3);
    const bjork = done.slate.results.find((r) => r.act.name === "Björk");
    expect(bjork?.act.matchConfidence).toBe(0.5);
    expect(bjork?.caveats.some((c) => c.type === "low-match-confidence")).toBe(true);
    expect(await rt.store.get(done.id)).not.toBeNull();
  });

  it("a confirmed run cannot be replayed", async () => {
    setRuntimeForTests(runtimeWith(transportWithBjork()));
    const waiting = await start({ ...ROOM, candidateActs: ["Khruangbin", "Radiohead", "Reality Club", "Bjork"] });
    const body = { choices: [{ actInput: "Bjork", entityId: "skip" }] };
    expect((await confirm(waiting.runId, body)).status).toBe(200);
    const again = await confirm(waiting.runId, body);
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: { code: "not_found", message: "This slate or act was not found." } });
  });

  it("an all-exact request is not held", async () => {
    setRuntimeForTests(runtimeWith(fixtureTransport()));
    const res = await createPost(post(ROOM));
    expect(((await res.json()) as { status: string }).status).toBe("done");
  });
});

describe("the server checks every choice against the candidates it returned", () => {
  async function waitingRun() {
    const rt = runtimeWith(transportWithBjork());
    setRuntimeForTests(rt);
    return start();
  }
  const standard = (body: unknown): void => {
    const e = (body as { error: { code: string; message: string } }).error;
    expect(Object.keys(body as object)).toEqual(["error"]);
    expect(e.code).toBe("invalid_input");
    expect(typeof e.message).toBe("string");
  };

  it("rejects an entityId that was not in the candidate list, in the standard error format", async () => {
    const waiting = await waitingRun();
    const res = await confirm(waiting.runId, { choices: [{ actInput: "Bjork", entityId: "E7649B3E-6FFE-46A1-85F3-836D842B2AF0" }] });
    expect(res.status).toBe(400);
    standard(await res.json());
  });

  it("rejects a missing choice, an unknown name, a repeated name, a choice for an exact row and malformed bodies", async () => {
    const waiting = await waitingRun();
    const id = waiting.matches.find((m) => m.state === "ambiguous")?.candidates[0]?.entityId ?? "";
    const bad: unknown[] = [
      { choices: [] },
      { choices: [{ actInput: "Not A Row", entityId: id }] },
      { choices: [{ actInput: "Bjork", entityId: id }, { actInput: "Bjork", entityId: "skip" }] },
      { choices: [{ actInput: "Bjork", entityId: id }, { actInput: "Apparat", entityId: id }] },
      { choices: [{ actInput: "Bjork", entityId: "x&filter.type=urn:entity:place" }] },
      { choices: [{ actInput: "Bjork" }] },
      { choices: "skip" },
      { choices: [{ actInput: "Bjork", entityId: id }], extra: true },
      "not json",
    ];
    for (const body of bad) {
      const res = await confirm(waiting.runId, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      standard(await res.json());
    }
    // None of the failed attempts used the run up.
    expect((await confirm(waiting.runId, { choices: [{ actInput: "Bjork", entityId: id }] })).status).toBe(200);
  });

  it("accepts the candidate id in any letter case, since ids are case-insensitive", async () => {
    const waiting = await waitingRun();
    const id = waiting.matches.find((m) => m.state === "ambiguous")?.candidates[0]?.entityId ?? "";
    expect((await confirm(waiting.runId, { choices: [{ actInput: "Bjork", entityId: id.toLowerCase() }] })).status).toBe(200);
  });

  it("answers 404 for an unknown or malformed run id", async () => {
    setRuntimeForTests(runtimeWith(fixtureTransport()));
    for (const id of ["AAAAAAAAAAAAAAAAAAAAA", "short", "x".repeat(40)]) {
      const res = await confirm(id, { choices: [] });
      expect(res.status).toBe(404);
    }
  });

  it("refuses to skip below the minimum number of acts", async () => {
    setRuntimeForTests(runtimeWith(transportWithBjork()));
    const waiting = await start();
    // 3 candidates, one skipped: 2 remain, below the minimum of 3.
    const res = await confirm(waiting.runId, { choices: [{ actInput: "Bjork", entityId: "skip" }] });
    expect(res.status).toBe(400);
    standard(await res.json());
  });
});

describe("skips, duplicates and notes", () => {
  it("skipping a not-in-recordings act removes it and leaves a note", async () => {
    setRuntimeForTests(runtimeWith(fixtureTransport()));
    const waiting = await start({ ...ROOM, candidateActs: ["Khruangbin", "Radiohead", "Reality Club", "Unrecorded Act"] });
    expect(waiting.matches.find((m) => m.actInput === "Unrecorded Act")).toMatchObject({ state: "not-in-recordings", candidates: [] });
    const res = await confirm(waiting.runId, { choices: [{ actInput: "Unrecorded Act", entityId: "skip" }] });
    const done = (await res.json()) as { slate: { results: { act: { name: string } }[]; notes: { type: string; subject: string }[] } };
    expect(done.slate.results.map((r) => r.act.name)).toEqual(["Reality Club", "Radiohead", "Khruangbin"]);
    expect(done.slate.notes).toEqual([{ type: "skipped", message: "Skipped by you, so it is not part of this slate.", subject: "Unrecorded Act" }]);
  });

  it("a name with no match can only be skipped, never given an entity", async () => {
    setRuntimeForTests(runtimeWith(fixtureTransport()));
    const waiting = await start({ ...ROOM, candidateActs: ["Khruangbin", "Radiohead", "Reality Club", "Zzqxv Nonexistentact 9731"] });
    const res = await confirm(waiting.runId, { choices: [{ actInput: "Zzqxv Nonexistentact 9731", entityId: "70CAE5BF-2F4C-445C-A3E5-4EDACFC3591C" }] });
    expect(res.status).toBe(400);
  });

  it("two inputs resolving to one entity give one act and a note", async () => {
    const real = transportWithBjork();
    // "Bjork" (chosen from the list) and "Biork" (top hit renamed to match exactly) are the same Qloo entity.
    const transport = fakeTransport(async (req) => {
      if (req.endpoint === "/search" && req.params.get("query") === "Biork") {
        const body = bjorkBody();
        (body.results[0] as Hit).name = "Biork";
        return { status: 200, body };
      }
      return real.get(req);
    });
    setRuntimeForTests(runtimeWith(transport));
    const waiting = await start({ ...ROOM, candidateActs: ["Khruangbin", "Radiohead", "Bjork", "Biork"] });
    const row = waiting.matches.find((m) => m.state === "ambiguous");
    const res = await confirm(waiting.runId, { choices: [{ actInput: "Bjork", entityId: row?.candidates[0]?.entityId ?? "" }] });
    const done = (await res.json()) as { slate: { results: { act: { name: string } }[]; notes: { type: string; subject: string }[] } };
    expect(done.slate.results.filter((r) => r.act.name === "Björk")).toHaveLength(1);
    expect(done.slate.notes).toEqual([{ type: "merged-duplicate", message: expect.stringContaining("count once"), subject: "Biork" }]);
    expect(transport.calls.filter((c) => isCompare(c.endpoint))).toHaveLength(3);
  });
});

describe("hostile entity names", () => {
  it("never alter an outgoing request: names are data, only entity ids are sent", async () => {
    const hostile = ["<script>alert(1)</script>", "Evil&filter.type=urn:entity:place", "x&take=999&bogus=1"];
    const transport = transportWithBjork((body) => {
      body.results.forEach((hit, i) => {
        hit.name = hostile[i % hostile.length] ?? hit.name;
      });
    });
    setRuntimeForTests(runtimeWith(transport));
    const waiting = await start();
    const row = waiting.matches.find((m) => m.state === "ambiguous");
    expect(row?.candidates.map((c) => c.name)).toContain("Evil&filter.type=urn:entity:place");
    const picked = row?.candidates.find((c) => c.name.startsWith("Evil"))?.entityId ?? "";
    const res = await confirm(waiting.runId, { choices: [{ actInput: "Bjork", entityId: picked }] });
    expect(res.status).toBe(200);
    for (const call of transport.calls) {
      expect(call.params.getAll("filter.type").filter((v) => v !== "urn:entity:artist")).toEqual([]);
      expect(call.params.has("bogus")).toBe(false);
      expect(call.params.get("take")).not.toBe("999");
      for (const value of call.params.values()) {
        expect(value).not.toContain("<script>");
        expect(value).not.toContain("Evil");
      }
    }
  });
});
