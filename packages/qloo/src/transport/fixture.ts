import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { QlooUnavailable } from "../errors";
import type { QlooTransport, TransportRequest, TransportResponse } from "./types";

interface Recording {
  readonly status: number;
  readonly body: unknown;
}

/** `fixtures/qloo` at the repository root, resolved from this file. */
export const DEFAULT_FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../fixtures/qloo");

function keyOf(endpoint: string, params: URLSearchParams): string {
  const sorted = new URLSearchParams([...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return `${endpoint}?${sorted.toString()}`;
}

/**
 * Replays the real recordings of M0-02 (`fixtures/qloo/index.json`, key = endpoint plus params sorted
 * by name). Needs no key and no network (DEMO_MODE=fixtures). A request with no recording is
 * reported as unavailable, never invented.
 */
export class FixtureTransport implements QlooTransport {
  private readonly index: Readonly<Record<string, string>>;

  constructor(private readonly dir: string = DEFAULT_FIXTURE_DIR) {
    this.index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) as Record<string, string>;
  }

  has(endpoint: string, params: URLSearchParams): boolean {
    return keyOf(endpoint, params) in this.index;
  }

  async get(req: TransportRequest): Promise<TransportResponse> {
    const file = this.index[keyOf(req.endpoint, req.params)];
    if (!file) throw new QlooUnavailable("No recorded Qloo response for this request");
    const rec = JSON.parse(readFileSync(join(this.dir, file), "utf8")) as Recording;
    return { status: rec.status, body: rec.body };
  }
}
