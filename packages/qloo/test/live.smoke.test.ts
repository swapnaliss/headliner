import { describe, expect, it } from "vitest";
import { createQlooClient } from "../src/client";
import { liveTransportFromEnv } from "../src/transport/live";

/**
 * One live search and one live compare against hackathon.api.qloo.com, shape-asserted by the client.
 * Skipped unless QLOO_LIVE=1 (needs QLOO_API_KEY in the environment). Two Qloo calls (plus the
 * entity-resolving searches it needs: 3 searches and 1 compare = 4 calls).
 */
describe.skipIf(process.env["QLOO_LIVE"] !== "1")("live smoke (QLOO_LIVE=1)", () => {
  it("one search and one compare pass the shape assertions", async () => {
    const c = createQlooClient({ transport: liveTransportFromEnv() });
    const apparat = await c.search("Apparat");
    expect(apparat.data[0]?.entityId).toBeTruthy();
    expect(apparat.evidence.responseDigest).toMatch(/^[0-9a-f]{64}$/);
    const modeselektor = await c.search("Modeselektor");
    const khruangbin = await c.search("Khruangbin");
    const a = [apparat.data[0]?.entityId, modeselektor.data[0]?.entityId].filter((x): x is string => typeof x === "string");
    const b = khruangbin.data[0]?.entityId;
    expect(b).toBeTruthy();
    const cmp = await c.compareAudiences(a, [b as string]);
    expect(cmp.data.length).toBeGreaterThan(0);
    expect(cmp.stale).toBe(false);
    expect(c.stats().liveCalls).toBe(4);
  }, 60_000);
});
