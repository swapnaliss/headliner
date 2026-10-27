import { MAX_PROPOSE_CALLS, runIntake, sanitizeInput } from "@headliner/agent";
import { z } from "zod";
import { metered } from "../../../src/budget";
import { getRuntime } from "../../../src/config";
import { ApiError, errorResponse, logFailure } from "../../../src/errors";
import { logged } from "../../../src/log";

export const dynamic = "force-dynamic";
/** Three model turns of a few seconds each, plus read-only Qloo searches. */
export const maxDuration = 60;

const MAX_BODY_BYTES = 4 * 1024;

/** `clarified: true` is sent with the sentence plus the booker's answer, after a question was asked once. */
const IntakeRequestSchema = z.object({ text: z.string(), clarified: z.boolean().optional() }).strict();

/**
 * POST /api/intake (M3-01, ADR 0009): one sentence in, a proposed room out. The result is a proposal; its
 * names still go through the match-confirmation screen. Response `status`: `room`, `clarification`,
 * `deterministic` (no model: use the form), `intake_failed`. Fixtures mode replays recorded traces.
 */
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
  const parsed = IntakeRequestSchema.safeParse(json);
  if (!parsed.success) return errorResponse("invalid_input", "Check: text.");
  // Guardrails before any budget reservation or model call.
  const sanitized = sanitizeInput(parsed.data.text);
  if (!sanitized.ok) return errorResponse("invalid_input", "Check: text.");

  try {
    const rt = getRuntime();
    const clarified = parsed.data.clarified === true;
    const provider = rt.intake?.providerFor(sanitized.text, clarified);
    const outcome = await metered(rt, { route: "intake", plannedCalls: MAX_PROPOSE_CALLS, request }, (r) =>
      runIntake(sanitized.text, {
        qloo: r.client,
        clarified,
        ...(rt.intake ? { source: rt.intake.source } : {}),
        ...(provider ? { provider } : {}),
        ...(rt.intake?.budgetFor ? { budget: rt.intake.budgetFor(request) } : {}),
      }),
    );
    if (outcome.status === "rejected") return errorResponse("invalid_input", "Check: text.");
    return Response.json(outcome, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (!(e instanceof ApiError && e.code === "demo_limit_reached")) logFailure("intake_failed", e);
    return e instanceof ApiError ? errorResponse(e.code, undefined, e.retryAfterSeconds) : errorResponse("internal_error");
  }
}

export const POST = logged("POST /api/intake", handlePOST);
