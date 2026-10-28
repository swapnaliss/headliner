import { resolve } from "node:path";
import { createQlooClient, FixtureTransport, InMemoryCacheStore, LiveTransport, type CacheEntry, type QlooEvent } from "@headliner/qloo";
import type { Runtime } from "../../apps/web/src/config";
import { logQlooEvent } from "../../apps/web/src/log";
import { MemoryRunStore } from "../../apps/web/src/runStore";
import { MemorySlateStore } from "../../apps/web/src/slateStore";

export const FIXTURE_DIR = resolve(__dirname, "../../fixtures/qloo");

/** Built at run time so no key-shaped literal is committed (gitleaks). */
export const FAKE_KEY = ["k", "fake", "security", "pass"].join("_") + "_" + "7Qz91".repeat(5);

/** Header names that must never appear in Evidence, a log line or a cache row. */
export const HEADER_NAMES = ["x-api-key", "authorization", "cookie", "set-cookie", "proxy-authorization"];

/** Cache that remembers every row written, so a test can scan what would be stored. */
export class RecordingCache extends InMemoryCacheStore {
  readonly written: CacheEntry[] = [];
  override async put(key: string, entry: CacheEntry, ttlSeconds: number, now: Date): Promise<void> {
    this.written.push(entry);
    return super.put(key, entry, ttlSeconds, now);
  }
}

/** A fetch that answers from the recorded fixtures, and remembers each request it was sent. */
export function fixtureBackedFetch(): { fn: typeof fetch; seen: { url: URL; headers: Record<string, string> }[] } {
  const fixtures = new FixtureTransport(FIXTURE_DIR);
  const seen: { url: URL; headers: Record<string, string> }[] = [];
  const fn = (async (input: URL | string, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(input);
    seen.push({ url, headers: { ...((init?.headers as Record<string, string> | undefined) ?? {}) } });
    const out = await fixtures.get({ endpoint: url.pathname, params: url.searchParams, signal: new AbortController().signal });
    return new Response(JSON.stringify(out.body), { status: out.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fn, seen };
}

export function runtimeOver(fetchFn: typeof fetch, opts: { timeoutMs?: number; cache?: InMemoryCacheStore; onEvent?: (e: QlooEvent) => void } = {}): Runtime & { store: MemorySlateStore } {
  return {
    mode: "live",
    client: createQlooClient({
      transport: new LiveTransport({ apiKey: FAKE_KEY, fetch: fetchFn }),
      cache: opts.cache ?? new InMemoryCacheStore(),
      sleep: async () => undefined,
      jitterMs: () => 0,
      ...(opts.timeoutMs === undefined ? {} : { timeoutMs: opts.timeoutMs }),
      onEvent: (e) => {
        logQlooEvent(e);
        opts.onEvent?.(e);
      },
    }),
    store: new MemorySlateStore(),
    runs: new MemoryRunStore(),
    now: () => new Date("2026-10-28T12:00:00.000Z"),
  };
}
