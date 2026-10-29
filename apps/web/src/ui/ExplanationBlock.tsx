import { Suspense } from "react";
import { headers } from "next/headers";
import type { Slate } from "@headliner/core";
import { getRuntime } from "../config";
import { getExplanation, templateExplanation, type ExplainScope } from "../explain";
import { Explanation } from "./Explanation";

async function Resolved({ slate, scope, id, disclosure }: { slate: Slate; scope: ExplainScope; id: string; disclosure: boolean }) {
  const rt = getRuntime();
  // Request headers are only needed (for the per-IP budget) when a model is wired.
  const requestHeaders = rt.explainModel ? await headers() : undefined;
  const explanation = await getExplanation(slate, scope, requestHeaders, rt);
  return <Explanation {...explanation} id={id} disclosure={disclosure} />;
}

/**
 * Server component for the slate and act detail pages. The template shows at once as the Suspense
 * fallback; the model's text, when one is wired and every figure checks out, replaces it.
 */
export function ExplanationBlock({ slate, actId, id = "explanation-heading", disclosure = false }: { slate: Slate; actId?: string; id?: string; disclosure?: boolean }) {
  const scope: ExplainScope = actId === undefined ? {} : { actId };
  return (
    <Suspense fallback={<Explanation {...templateExplanation(slate, scope)} id={id} pending disclosure={disclosure} />}>
      <Resolved slate={slate} scope={scope} id={id} disclosure={disclosure} />
    </Suspense>
  );
}
