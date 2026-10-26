import { createHash } from "node:crypto";

/**
 * The checkable record behind every number (CLAUDE.md domain rules). It holds the endpoint, the
 * redacted request parameters (entity ids and typed query values; no credential is ever a parameter),
 * the digest of the shape-validated response and when it was fetched. The credential header is
 * never stored, logged or returned.
 */
export interface Evidence {
  readonly endpoint: string;
  readonly redactedParams: Readonly<Record<string, string>>;
  /** SHA-256 (hex) of the canonical JSON of the validated, reduced response that was cached. */
  readonly responseDigest: string;
  /** ISO timestamp of the live fetch that produced the data (kept on cache hits). */
  readonly fetchedAt: string;
}

/** JSON with object keys sorted at every depth, so equal values give equal text. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const parts = Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function digestOf(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function makeEvidence(endpoint: string, params: URLSearchParams, data: unknown, fetchedAt: Date): Evidence {
  const redactedParams: Record<string, string> = {};
  for (const [k, v] of [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) redactedParams[k] = v;
  return { endpoint, redactedParams, responseDigest: digestOf(data), fetchedAt: fetchedAt.toISOString() };
}
