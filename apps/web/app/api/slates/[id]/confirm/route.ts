import { ConfirmRequestSchema } from "@headliner/core";
import { getRuntime } from "../../../../../src/config";
import { ApiError, errorResponse, logFailure } from "../../../../../src/errors";
import { confirmRun } from "../../../../../src/pipeline/createSlate";
import { isSlateId } from "../../../../../src/slateStore";

export const dynamic = "force-dynamic";
/** Same budget as the create route: this call runs the compare and scoring half of the run. */
export const maxDuration = 60;

const MAX_BODY_BYTES = 8 * 1024;

/** Schema paths only (for example `choices.2.entityId`): input values are never echoed back. */
function invalidDetail(paths: readonly (readonly PropertyKey[])[]): string {
  const fields = [...new Set(paths.map((p) => p.map(String).join(".") || "body"))].slice(0, 5);
  return `Check: ${fields.join(", ")}.`;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
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
    const outcome = await confirmRun(runId, parsed.data.choices, getRuntime());
    return Response.json(outcome, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    logFailure("confirm_run_failed", e);
    return e instanceof ApiError ? errorResponse(e.code, e.detail) : errorResponse("internal_error");
  }
}
