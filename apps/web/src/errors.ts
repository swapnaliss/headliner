import { currentRunId } from "./log";

/**
 * One error format for every API route: `{ error: { code, message } }`. The message is fixed per
 * code. Upstream detail (Qloo bodies, stack traces, request URLs, the credential) never reaches
 * the client, so nothing here accepts free text from a caught error.
 */
export const ERROR_CODES = ["invalid_input", "rate_limited", "upstream_unavailable", "internal_error", "not_found", "demo_limit_reached"] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS: Readonly<Record<ErrorCode, number>> = {
  invalid_input: 400,
  not_found: 404,
  rate_limited: 429,
  demo_limit_reached: 429,
  upstream_unavailable: 503,
  internal_error: 500,
};

const MESSAGE: Readonly<Record<ErrorCode, string>> = {
  invalid_input: "The request is not valid.",
  not_found: "This slate or act was not found.",
  rate_limited: "Too many requests to the data provider. Try again in a minute.",
  demo_limit_reached: "Daily demo limit reached. Saved sample rooms and slates still work; live lookups resume after midnight UTC.",
  upstream_unavailable: "The data provider is unavailable. Try again shortly.",
  internal_error: "Something went wrong on our side.",
};

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    /** Optional safe addition built from schema paths only, never from input values. */
    readonly detail?: string,
    /** Seconds until the daily budget resets (next UTC midnight); sent as `Retry-After`. */
    readonly retryAfterSeconds?: number,
  ) {
    super(MESSAGE[code]);
    this.name = "ApiError";
  }
}

export function errorResponse(code: ErrorCode, detail?: string, retryAfterSeconds?: number): Response {
  const message = detail ? `${MESSAGE[code]} ${detail}` : MESSAGE[code];
  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (retryAfterSeconds !== undefined) headers["retry-after"] = String(Math.max(1, Math.ceil(retryAfterSeconds)));
  return Response.json({ error: { code, message } }, { status: STATUS[code], headers });
}

/** Operational log line: the error class and a code, never a message, stack or upstream text. Carries the request's run id. */
export function logFailure(event: string, error: unknown): void {
  const kind = error instanceof ApiError ? error.code : error instanceof Error ? error.name : "unknown";
  console.error(JSON.stringify({ level: "error", event, kind, runId: currentRunId() ?? "none" }));
}
