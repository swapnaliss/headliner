import { QlooTimeout, QlooUnavailable } from "../errors";
import type { QlooTransport, TransportRequest, TransportResponse } from "./types";

/** The hackathon key works only against this host (CLAUDE.md). It is fixed, not configurable. */
export const QLOO_BASE_URL = "https://hackathon.api.qloo.com";

export interface LiveTransportOptions {
  /** The credential. Held in memory only; read by the caller from server env, never from client code. */
  readonly apiKey: string;
  /** Test seam; defaults to global fetch. */
  readonly fetch?: typeof fetch;
}

/**
 * The only place the credential header is set. Failures are mapped to safe errors with fixed text:
 * a fetch exception can carry the URL, so its message is dropped.
 */
export class LiveTransport implements QlooTransport {
  private readonly apiKey: string;
  private readonly doFetch: typeof fetch;

  constructor(options: LiveTransportOptions) {
    if (!options.apiKey) throw new QlooUnavailable("Qloo is not configured");
    this.apiKey = options.apiKey;
    this.doFetch = options.fetch ?? fetch;
  }

  async get(req: TransportRequest): Promise<TransportResponse> {
    const url = new URL(req.endpoint, QLOO_BASE_URL);
    url.search = req.params.toString();
    let res: Response;
    try {
      res = await this.doFetch(url, {
        method: "GET",
        headers: { "X-Api-Key": this.apiKey, Accept: "application/json" },
        signal: req.signal,
        redirect: "error",
      });
    } catch (e) {
      if (req.signal.aborted || (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError"))) {
        throw new QlooTimeout();
      }
      throw new QlooUnavailable("Qloo could not be reached");
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    return { status: res.status, body };
  }
}

/** Build the live transport from server env. Throws a safe error when the key is absent. */
export function liveTransportFromEnv(env: Record<string, string | undefined> = process.env): LiveTransport {
  const apiKey = env["QLOO_API_KEY"];
  if (!apiKey) throw new QlooUnavailable("Qloo is not configured");
  return new LiveTransport({ apiKey });
}
