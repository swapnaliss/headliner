/** The `error.code` of an API error body, or null. Only the fixed code is read; message text is never shown. */
export function errorCode(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** Shown on a 429 with this code: the daily per-visitor or global demo limit (M2-05). */
export const DEMO_LIMIT_CODE = "demo_limit_reached";
