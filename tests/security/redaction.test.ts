import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../apps/web/app/api/slates/route";
import { setRuntimeForTests } from "../../apps/web/src/config";
import { post, ROOM } from "../../apps/web/test/helpers";
import { FAKE_KEY, fixtureBackedFetch, HEADER_NAMES, RecordingCache, runtimeOver } from "./support";

/**
 * M4-03 scope 2. The Qloo adapter runs behind a fetch that answers from the recorded fixtures. The credential really
 * is sent (the fake sees the header), yet no Evidence, API response, log line or cache row contains the key, the
 * header name or any header. Adapter-level cases live in packages/qloo/test/redaction.test.ts (M1-01).
 */

/** Evidence holds only these fields: endpoint and redacted params, a digest and a time (never a header). */
const EVIDENCE_FIELDS = new Set(["id", "endpoint", "redactedParams", "responseDigest", "fetchedAt", "status"]);

let logs: string[];
beforeEach(() => {
  logs = [];
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logs.push(args.map(String).join(" ")));
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  setRuntimeForTests(undefined);
});

function findEvidence(value: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) value.forEach((v) => findEvidence(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "evidence" && Array.isArray(v)) out.push(...(v as Record<string, unknown>[]));
      else findEvidence(v, out);
    }
  }
  return out;
}

function leaks(text: string): string[] {
  const lower = text.toLowerCase();
  return [FAKE_KEY, ...HEADER_NAMES].filter((s) => lower.includes(s.toLowerCase()));
}

describe("a full slate run through the Qloo adapter", () => {
  it("sends the credential upstream but leaks it nowhere", async () => {
    const f = fixtureBackedFetch();
    const cache = new RecordingCache();
    setRuntimeForTests(runtimeOver(f.fn, { cache }));

    const res = await POST(post(ROOM));
    expect(res.status).toBe(200);
    const text = await res.text();

    // The test is meaningful only if the credential was really on the wire, as a header, not in the URL.
    expect(f.seen.length).toBeGreaterThan(0);
    for (const s of f.seen) {
      expect(s.headers["X-Api-Key"]).toBe(FAKE_KEY);
      expect(s.url.toString()).not.toContain(FAKE_KEY);
    }

    const body = JSON.parse(text) as unknown;
    const evidence = findEvidence(body);
    expect(evidence.length).toBeGreaterThan(0);
    for (const e of evidence) {
      expect(Object.keys(e).filter((k) => !EVIDENCE_FIELDS.has(k))).toEqual([]); // no extra field, in particular no header map
      expect(Object.keys(e.redactedParams as object).map((k) => k.toLowerCase()).filter((k) => HEADER_NAMES.includes(k))).toEqual([]);
    }

    expect(leaks(text)).toEqual([]); // API response
    expect(logs.length).toBeGreaterThan(0);
    expect(leaks(logs.join("\n"))).toEqual([]); // every console line of the run
    expect(cache.written.length).toBeGreaterThan(0);
    expect(leaks(JSON.stringify(cache.written))).toEqual([]); // every cache row written
  });

  it("the stored slate (what /s/<id> serves) carries no key or header either", async () => {
    const f = fixtureBackedFetch();
    const rt = runtimeOver(f.fn);
    setRuntimeForTests(rt);
    const made = (await (await POST(post(ROOM))).json()) as { id: string };
    const stored = await rt.store.get(made.id);
    expect(stored).not.toBeNull();
    expect(leaks(JSON.stringify(stored))).toEqual([]);
  });
});
