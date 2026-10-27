import { describe, expect, it } from "vitest";
import { fixtureBody, CROWD, KHRUANGBIN } from "../test/helpers";
import { createQlooClient } from "./client";
import { evidenceRequestText, makeEvidence, redactEvidence, type PublicEvidence } from "./evidence";
import { LiveTransport } from "./transport/live";

// The canary stands in for the hackathon key. It is read from the environment (the gate sets it)
// and is never printed: a failed assertion reports counts, not the value.
const CANARY = process.env["CANARY_KEY"] ?? "canary-xyz-123";
const HEADER_WORDS = /x-api-key|authorization|api[_-]?key|headers?/i;

function fakeFetch(body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
}

async function liveEvidence() {
  const client = createQlooClient({
    transport: new LiveTransport({ apiKey: CANARY, fetch: fakeFetch(fixtureBody("search--apparat.json")) }),
  });
  const search = await client.search("Apparat");
  const compareClient = createQlooClient({
    transport: new LiveTransport({ apiKey: CANARY, fetch: fakeFetch(fixtureBody("compare--list6-crowd-vs-khruangbin.json")) }),
  });
  const compare = await compareClient.compareAudiences(CROWD, [KHRUANGBIN]);
  return [search.evidence, compare.evidence];
}

describe("redactEvidence", () => {
  it("keeps endpoint path, filter.type, entity ids, city, status, fetchedAt and digest", async () => {
    const [, compare] = await liveEvidence();
    const pub = redactEvidence({ ...compare!, id: "ev-abc123def456" });
    expect(pub.id).toBe("ev-abc123def456");
    expect(pub.endpoint).toBe("/v2/insights/compare");
    expect(pub.params.filterType).toBe("urn:entity:artist");
    expect(pub.params.entityGroups.map((g) => [g.role, g.ids.length])).toEqual([
      ["a", 6],
      ["b", 1],
    ]);
    expect(pub.status).toBe("ok");
    expect(pub.responseDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(pub.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("keeps the city of a heatmap request", () => {
    const params = new URLSearchParams({ "filter.location.query": "Tromsø", "filter.type": "urn:heatmap", "signal.interests.entities": CROWD[0] as string });
    const pub = redactEvidence(makeEvidence("/v2/insights", params, { cells: 1 }, new Date("2026-10-26T10:00:00Z")));
    expect(pub.params.city).toBe("Tromsø");
    expect(pub.params.entityGroups).toEqual([{ role: "signal", ids: [CROWD[0]] }]);
  });

  it("drops every parameter outside the whitelist, whatever its name", () => {
    const pub = redactEvidence({
      endpoint: "/search",
      redactedParams: { query: "Apparat", "X-Api-Key": CANARY, api_key: CANARY, authorization: `Bearer ${CANARY}`, token: CANARY, "bogus.parameter": "x", take: "5" },
      responseDigest: "a".repeat(64),
      fetchedAt: "2026-10-26T10:00:00.000Z",
    });
    const text = JSON.stringify(pub);
    expect(text.split(CANARY).length - 1).toBe(0);
    expect(HEADER_WORDS.test(text)).toBe(false);
    expect(text).not.toContain("bogus");
    expect(pub.params.query).toBe("Apparat");
    expect(pub.params.take).toBe(5);
  });

  it("cannot serialise a header map, a key or a raw body, even when the input carries them", async () => {
    const [search] = await liveEvidence();
    const hostile = {
      ...search!,
      headers: { "X-Api-Key": CANARY, Accept: "application/json" },
      requestHeaders: new Map([["X-Api-Key", CANARY]]),
      body: { errors: [{ message: `UPSTREAM-LEAK-MARKER ${CANARY}` }] },
      error: `fetch failed https://hackathon.api.qloo.com/search?x-api-key=${CANARY}`,
    };
    const text = JSON.stringify(redactEvidence(hostile));
    expect(text.split(CANARY).length - 1).toBe(0);
    expect(text).not.toContain("UPSTREAM-LEAK-MARKER");
    expect(text).not.toContain("hackathon.api");
    expect(HEADER_WORDS.test(text)).toBe(false);
    expect(Object.keys(redactEvidence(hostile)).sort()).toEqual(["endpoint", "fetchedAt", "id", "params", "responseDigest", "status"]);
  });

  it("has no place for headers in the type", () => {
    const base: PublicEvidence = {
      id: "ev-1",
      endpoint: "/search",
      params: { filterType: null, types: null, entityGroups: [], city: null, query: null, take: null },
      status: "ok",
      fetchedAt: "2026-10-26T10:00:00.000Z",
      responseDigest: null,
    };
    // The compiler (typecheck in the gate) rejects a header map on the public type.
    // @ts-expect-error a header map is not part of PublicEvidence
    const withHeaders: PublicEvidence = { ...base, headers: { "X-Api-Key": CANARY } };
    expect(withHeaders.id).toBe("ev-1");
    expect(Object.keys(base)).not.toContain("headers");
  });

  it("a full run's public evidence and request text contain no key, no header section", async () => {
    const all = await liveEvidence();
    const published = all.map((e) => redactEvidence(e));
    const text = JSON.stringify(published) + published.map(evidenceRequestText).join("\n");
    expect(text.split(CANARY).length - 1).toBe(0);
    expect(HEADER_WORDS.test(text)).toBe(false);
  });

  it("sanitises hostile values: bad endpoint, control characters, oversized text, bad digest, odd take", () => {
    const pub = redactEvidence({
      endpoint: "/search?x=1",
      redactedParams: { query: `A\u0000B\n${"z".repeat(500)}`, take: "9999", "signal.interests.entities": "not an id,<script>,DB342083-22F9-4B2D-B6F4-414AAF35F217" },
      responseDigest: "not-a-digest",
      fetchedAt: "2026-10-26T10:00:00.000Z",
    });
    expect(pub.endpoint).toBe("/search");
    expect(pub.params.query?.length).toBe(200);
    expect(pub.params.query).not.toMatch(/\p{Cc}/u);
    expect(pub.params.take).toBeNull();
    expect(pub.params.entityGroups).toEqual([{ role: "signal", ids: ["DB342083-22F9-4B2D-B6F4-414AAF35F217"] }]);
    expect(pub.responseDigest).toBeNull();
    expect(redactEvidence({ endpoint: "javascript:alert(1)", redactedParams: {}, fetchedAt: "x" }).endpoint).toBe("/unknown");
  });

  it("request text is plain, one parameter per line, and a failed call shows no digest", () => {
    const pub = redactEvidence({ endpoint: "/search", redactedParams: { query: "Apparat", take: "5" }, fetchedAt: "2026-10-26T10:00:00.000Z", status: "failed" });
    expect(evidenceRequestText(pub)).toBe(
      ["GET /search", "query=Apparat", "take=5", "status=failed", "fetchedAt=2026-10-26T10:00:00.000Z", "responseDigest=none"].join("\n"),
    );
  });
});
