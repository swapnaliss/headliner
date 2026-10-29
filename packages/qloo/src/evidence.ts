import { createHash } from "node:crypto";

/**
 * The checkable record behind every number (project domain rules). It holds the endpoint, the
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

export type EvidenceStatus = "ok" | "failed";

/** What `redactEvidence` accepts: any evidence-like record. Extra fields (a header map, a body) are never read. */
export interface EvidenceInput {
  readonly id?: string;
  readonly endpoint: string;
  readonly redactedParams: Readonly<Record<string, string>>;
  readonly responseDigest?: string | null;
  readonly fetchedAt: string;
  readonly status?: EvidenceStatus;
}

export interface PublicEntityGroup {
  /** "a" (crowd), "b" (candidate) or "signal". */
  readonly role: string;
  readonly ids: readonly string[];
}

/** The typed request parameters worth showing. Nothing else from a request is ever kept. */
export interface PublicEvidenceParams {
  readonly filterType: string | null;
  /** Entity type searched (`types` on /search). */
  readonly types: string | null;
  readonly entityGroups: readonly PublicEntityGroup[];
  readonly city: string | null;
  readonly query: string | null;
  readonly take: number | null;
}

/**
 * The only evidence shape that leaves the server (act detail, share view, exports). It has no
 * header, key, body or error field at all, so none can be serialised.
 */
export interface PublicEvidence {
  readonly id: string;
  /** Path only, for example `/v2/insights`. */
  readonly endpoint: string;
  readonly params: PublicEvidenceParams;
  readonly status: EvidenceStatus;
  readonly fetchedAt: string;
  /** SHA-256 hex of the validated response, or null when there is none (a failed call). */
  readonly responseDigest: string | null;
}

const ENTITY_KEY = /^(?:([a-z]+)\.)?signal\.interests\.entities$/;
const ENDPOINT = /^\/[A-Za-z0-9/_-]{1,80}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_VALUE = 200;

const CONTROL = new RegExp(String.raw`[\u0000-\u001f\u007f\u2028\u2029]`, "g");

function clean(value: string): string {
  return value.replace(CONTROL, "").slice(0, MAX_VALUE);
}

/**
 * Public, redacted form of one Qloo call. Whitelist only: the endpoint path, filter.type, entity
 * ids, city, query text, take, status, fetchedAt and the response digest. Any other parameter is
 * dropped. Headers cannot appear because the type has no place for them.
 */
export function redactEvidence(evidence: EvidenceInput): PublicEvidence {
  const raw = evidence.redactedParams;
  const groups: PublicEntityGroup[] = [];
  for (const key of Object.keys(raw).sort()) {
    const m = ENTITY_KEY.exec(key);
    if (!m) continue;
    const ids = clean(raw[key] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[A-Za-z0-9-]{1,64}$/.test(s));
    if (ids.length > 0) groups.push({ role: m[1] ?? "signal", ids });
  }
  const take = Number(raw["take"]);
  const path = evidence.endpoint.split("?")[0] ?? "";
  const digest = evidence.responseDigest ?? null;
  const fetched = clean(evidence.fetchedAt);
  return {
    id: evidence.id !== undefined && ID.test(evidence.id) ? evidence.id : `ev-${(digest ?? "none").slice(0, 12)}`,
    endpoint: ENDPOINT.test(path) ? path : "/unknown",
    params: {
      filterType: raw["filter.type"] !== undefined ? clean(raw["filter.type"]) : null,
      types: raw["types"] !== undefined ? clean(raw["types"]) : null,
      entityGroups: groups,
      city: raw["filter.location.query"] !== undefined ? clean(raw["filter.location.query"]) : null,
      query: raw["query"] !== undefined ? clean(raw["query"]) : null,
      take: Number.isInteger(take) && take > 0 && take <= 100 ? take : null,
    },
    status: evidence.status ?? "ok",
    fetchedAt: fetched,
    responseDigest: digest !== null && DIGEST.test(digest) ? digest : null,
  };
}

/** The request as copyable plain text: `GET /v2/search` then one `name=value` line per parameter. */
export function evidenceRequestText(evidence: PublicEvidence): string {
  const lines = [`GET ${evidence.endpoint}`];
  const p = evidence.params;
  if (p.query !== null) lines.push(`query=${p.query}`);
  if (p.types !== null) lines.push(`types=${p.types}`);
  if (p.filterType !== null) lines.push(`filter.type=${p.filterType}`);
  if (p.city !== null) lines.push(`filter.location.query=${p.city}`);
  for (const g of p.entityGroups) lines.push(`${g.role === "signal" ? "" : `${g.role}.`}signal.interests.entities=${g.ids.join(",")}`);
  if (p.take !== null) lines.push(`take=${p.take}`);
  lines.push(`status=${evidence.status}`);
  lines.push(`fetchedAt=${evidence.fetchedAt}`);
  lines.push(`responseDigest=${evidence.responseDigest ?? "none"}`);
  return lines.join("\n");
}

export function makeEvidence(endpoint: string, params: URLSearchParams, data: unknown, fetchedAt: Date): Evidence {
  const redactedParams: Record<string, string> = {};
  for (const [k, v] of [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) redactedParams[k] = v;
  return { endpoint, redactedParams, responseDigest: digestOf(data), fetchedAt: fetchedAt.toISOString() };
}
