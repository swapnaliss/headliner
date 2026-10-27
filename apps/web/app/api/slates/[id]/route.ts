import { getRuntime } from "../../../../src/config";
import { errorResponse, logFailure } from "../../../../src/errors";
import { getExplanation } from "../../../../src/explain";
import { logged } from "../../../../src/log";
import { isSlateId } from "../../../../src/slateStore";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/**
 * The slate's header and its explanation (M3-02). No Qloo call is made; the explanation is the
 * model's text only when every figure in it is in the slate, otherwise the template. The body
 * carries no evidence and no stored text beyond the resolved city: per-act detail is
 * `GET /api/slates/:id/acts/:actId`.
 */
async function handleGET(request: Request, { params }: { params: Params }): Promise<Response> {
  const { id } = await params;
  if (!isSlateId(id)) return errorResponse("not_found");
  try {
    const rt = getRuntime();
    const slate = await rt.store.get(id);
    if (!slate) return errorResponse("not_found");
    const explanation = await getExplanation(slate, {}, request.headers, rt);
    return Response.json({ id: slate.id, city: slate.room.city, createdAt: slate.createdAt, explanation }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    logFailure("slate_read_failed", e);
    return errorResponse("internal_error");
  }
}

export const GET = logged("GET /api/slates/[id]", handleGET);
