import { ConfirmRequestSchema } from "@headliner/core";
import { metered } from "../../../../../src/budget";
import { getRuntime } from "../../../../../src/config";
import { ApiError, errorResponse, logFailure } from "../../../../../src/errors";
import { confirmRun } from "../../../../../src/pipeline/createSlate";
import { isSlateId } from "../../../../../src/slateStore";
import { logged } from "../../../../../src/log";

export const dynamic = "force-dynamic";
/** Same budget as the create route: this call runs the compare and scoring half of the run. */
export const maxDuration = 60;

const MAX_BODY_BYTES = 8 * 1024;

/** Schema paths only (for example `choices.2.entityId`): input values are never echoed back. */
function invalidDetail(paths: readonly (readonly PropertyKey[])[]): string {
  const fields = [...new Set(paths.map((p) => p.map(String).join(".") || "body"))].slice(0, 5);
  return `Check: ${fields.join(", ")}.`;
}

async function handlePOST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: runId } = await context.params;
  if (!isSlateId(runId)) return errorResponse("not_found");

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
  const parsed = ConfirmRequestSchema.safeParse(json);
  if (!parsed.success) return errorResponse("invalid_input", invalidDetail(parsed.error.issues.map((i) => i.path)));

  try {
    const rt = getRuntime();
    // An unknown run costs nothing: look it up before asking the budget. One compare per candidate.
    const run = await rt.runs.get(runId);
    if (!run) return errorResponse("not_found");
    const plannedCalls = run.matches.filter((m) => m.role === "candidate").length;
    const outcome = await metered(rt, { route: "confirm", plannedCalls, request }, (m) => confirmRun(runId, parsed.data.choices, m));
    return Response.json(outcome, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (!(e instanceof ApiError && e.code === "demo_limit_reached")) logFailure("confirm_run_failed", e);
    return e instanceof ApiError ? errorResponse(e.code, e.detail, e.retryAfterSeconds) : errorResponse("internal_error");
  }
}

export const POST = logged("POST /api/slates/[id]/confirm", handlePOST);
