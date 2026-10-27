import { buildActDetail, decodeActId } from "../../../../../../src/actDetail";
import { getRuntime } from "../../../../../../src/config";
import { errorResponse, logFailure } from "../../../../../../src/errors";
import { isSlateId } from "../../../../../../src/slateStore";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; actId: string }>;

/**
 * The act detail from the stored Slate (docs/design/screen-act-detail.md). No Qloo call is made.
 * Evidence is the redacted public form only. Any failure is a fixed generic error: stored or
 * upstream text never reaches the client.
 */
export async function GET(_request: Request, { params }: { params: Params }): Promise<Response> {
  const { id, actId } = await params;
  if (!isSlateId(id)) return errorResponse("not_found");
  try {
    const slate = await getRuntime().store.get(id);
    const detail = slate ? buildActDetail(slate, decodeActId(actId)) : null;
    if (!detail) return errorResponse("not_found");
    return Response.json(detail, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    logFailure("act_detail_failed", e);
    return errorResponse("internal_error");
  }
}
