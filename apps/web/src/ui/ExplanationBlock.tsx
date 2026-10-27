import { Suspense } from "react";
import { headers } from "next/headers";
import type { Slate } from "@headliner/core";
import { getRuntime } from "../config";
import { getExplanation, templateExplanation, type ExplainScope } from "../explain";
import { Explanation } from "./Explanation";

async function Resolved({ slate, scope, id }: { slate: Slate; scope: ExplainScope; id: string }) {
  const rt = getRuntime();
  // Request headers are only needed (for the per-IP budget) when a model is wired.
  const requestHeaders = rt.explainModel ? await headers() : undefined;
  const explanation = await getExplanation(slate, scope, requestHeaders, rt);
  return <Explanation {...explanation} id={id} />;
}

/**
 * Server component for the slate and act detail pages. The template shows at once as the Suspense
 * fallback; the model's text, when one is wired and every figure checks out, replaces it.
 */
export function ExplanationBlock({ slate, actId, id = "explanation-heading" }: { slate: Slate; actId?: string; id?: string }) {
  const scope: ExplainScope = actId === undefined ? {} : { actId };
  return (
    <Suspense fallback={<Explanation {...templateExplanation(slate, scope)} id={id} />}>
      <Resolved slate={slate} scope={scope} id={id} />
    </Suspense>
  );
}
