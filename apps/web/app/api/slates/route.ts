import { CreateSlateRequestSchema } from "@headliner/core";
import { metered } from "../../../src/budget";
import { getRuntime } from "../../../src/config";
import { ApiError, errorResponse, logFailure } from "../../../src/errors";
import { createSlate, normalizeName } from "../../../src/pipeline/createSlate";
import { logged } from "../../../src/log";

export const dynamic = "force-dynamic";
/** ADR 0004: the whole run is one request; a cold 6x12 slate needs several seconds of Qloo time. */
export const maxDuration = 60;

const MAX_BODY_BYTES = 16 * 1024;

/** Schema paths only (for example `crowdActs.2`): input values are never echoed back. */
function invalidDetail(paths: readonly (readonly PropertyKey[])[]): string {
  const fields = [...new Set(paths.map((p) => p.map(String).join(".") || "body"))].slice(0, 5);
  return `Check: ${fields.join(", ")}.`;
}

async function handlePOST(request: Request): Promise<Response> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return errorResponse("invalid_input");
  }
  if (raw.length > MAX_BODY_BYTES) return errorResponse("invalid_input", "Check: body.");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return errorResponse("invalid_input", "Check: body.");
  }
  const parsed = CreateSlateRequestSchema.safeParse(json);
  if (!parsed.success) return errorResponse("invalid_input", invalidDetail(parsed.error.issues.map((i) => i.path)));

  try {
    // Upper bound on live calls: one search per distinct name, plus one compare per distinct candidate
    // when every name matches exactly (cache hits and unused calls are given back afterwards).
    const distinct = (names: readonly string[]): number => new Set(names.map(normalizeName)).size;
    const plannedCalls = distinct([...parsed.data.crowdActs, ...parsed.data.candidateActs]) + distinct(parsed.data.candidateActs);
    const outcome = await metered(getRuntime(), { route: "create", plannedCalls, request }, (rt) => createSlate(parsed.data, rt));
    return Response.json(outcome, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (!(e instanceof ApiError && e.code === "demo_limit_reached")) logFailure("create_slate_failed", e);
    return e instanceof ApiError ? errorResponse(e.code, undefined, e.retryAfterSeconds) : errorResponse("internal_error");
  }
}

export const POST = logged("POST /api/slates", handlePOST);
