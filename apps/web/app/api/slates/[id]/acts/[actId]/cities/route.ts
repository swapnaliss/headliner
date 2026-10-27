import { CityStrengthRequestSchema } from "@headliner/core";
import { getRuntime } from "../../../../../../../src/config";
import { ApiError, errorResponse, logFailure } from "../../../../../../../src/errors";
import { loadCityStrength } from "../../../../../../../src/pipeline/cityStrength";
import { isSlateId } from "../../../../../../../src/slateStore";

export const dynamic = "force-dynamic";
/** Up to 5 heatmap calls at a concurrency of 3: a few seconds at most, well inside this. */
export const maxDuration = 30;

const MAX_BODY_BYTES = 4 * 1024;
const MAX_ACT_ID_LENGTH = 100;

type Context = { params: Promise<{ id: string; actId: string }> };

/**
 * Lazy city strength for one act (ADR 0004). Nothing here runs at create-slate time: the client
 * asks when the act is opened. `{ cities: string[] }` (max 5, name length 80) in, per-city
 * aggregates and thin-data caveats out; one failing city is a `no_data` entry and the others return.
 */
export async function POST(request: Request, context: Context): Promise<Response> {
  const { id, actId } = await context.params;
  if (!isSlateId(id) || actId.length === 0 || actId.length > MAX_ACT_ID_LENGTH) return errorResponse("not_found");

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
  const parsed = CityStrengthRequestSchema.safeParse(json);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.map(String).join(".") || "body"))].slice(0, 5);
    return errorResponse("invalid_input", `Check: ${fields.join(", ")}.`);
  }

  try {
    const body = await loadCityStrength(getRuntime(), { slateId: id, actId, cities: parsed.data.cities, request });
    return Response.json(body, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (!(e instanceof ApiError)) logFailure("city_strength_failed", e);
    return e instanceof ApiError ? errorResponse(e.code) : errorResponse("internal_error");
  }
}
