import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createQlooClient,
  FixtureTransport,
  InMemoryCacheStore,
  type QlooClient,
  type QlooTransport,
  type TransportRequest,
  type TransportResponse,
} from "@headliner/qloo";
import type { Runtime } from "../src/config";
import { MemoryRunStore } from "../src/runStore";
import { MemorySlateStore } from "../src/slateStore";

export const FIXTURE_DIR = resolve(__dirname, "../../../fixtures/qloo");

export const ROOM = JSON.parse(readFileSync(resolve(__dirname, "fixtures", "room.json"), "utf8")) as {
  city: string;
  crowdActs: string[];
  candidateActs: string[];
};

export interface CountingTransport extends QlooTransport {
  readonly calls: TransportRequest[];
}

/** Wraps a transport and records every request that reaches it. */
export function counting(inner: QlooTransport): CountingTransport {
  const calls: TransportRequest[] = [];
  return {
    calls,
    async get(req) {
      calls.push(req);
      return inner.get(req);
    },
  };
}

export function fixtureTransport(): CountingTransport {
  return counting(new FixtureTransport(FIXTURE_DIR));
}

export function runtimeWith(transport: QlooTransport, mode: "fixtures" | "live" = "fixtures"): Runtime & { store: MemorySlateStore } {
  return {
    mode,
    client: createQlooClient({ transport, cache: new InMemoryCacheStore(), sleep: async () => undefined, jitterMs: () => 0 }),
    store: new MemorySlateStore(),
    runs: new MemoryRunStore(),
    now: () => new Date("2026-10-26T12:00:00.000Z"),
  };
}

export function fakeTransport(handler: (req: TransportRequest) => TransportResponse | Promise<TransportResponse>): CountingTransport {
  return counting({ get: async (req) => handler(req) });
}

export function post(body: unknown): Request {
  return new Request("http://localhost/api/slates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export type { QlooClient };
