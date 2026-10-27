// Fit sanity test data (M3-04). For each pre-registered crowd: resolve the crowd, the same-genre candidates and
// the off-genre control, run one list compare per candidate (whole crowd on side A, ADR 0013) and compute Fit
// with the core function. Reports whether each same-genre candidate outranked the control. Nothing is tuned.
import { computeFit } from "../../packages/core/src/index";
import type { QlooClient } from "../../packages/qloo/src/index";
import { resolveName, type FitSet } from "./common";

export interface CandidateRow {
  readonly name: string;
  readonly role: "same-genre" | "control";
  readonly resolved: boolean;
  /** Fit 0..100 (one decimal) or null when unavailable. */
  readonly fit: number | null;
  readonly sharedTags: number | null;
  readonly unavailableReason: string | null;
  /** Same-genre rows only: Fit strictly greater than the control's Fit. Null when either Fit is unavailable. */
  readonly outranksControl: boolean | null;
}

export interface CrowdRow {
  readonly id: string;
  readonly description: string;
  readonly crowd: readonly { readonly name: string; readonly resolved: boolean }[];
  readonly candidates: readonly CandidateRow[];
  readonly control: CandidateRow;
  readonly outranking: number;
  readonly comparable: number;
}

export interface FitSanityResult {
  readonly crowds: readonly CrowdRow[];
  readonly summary: { readonly crowdCount: number; readonly sameGenreCandidates: number; readonly comparable: number; readonly outranking: number };
}

export async function runFitSanity(client: QlooClient, set: FitSet): Promise<FitSanityResult> {
  const crowds: CrowdRow[] = [];
  for (const c of set.crowds) {
    const crowdRes = await Promise.all(c.crowd.map(async (name) => ({ name, res: await resolveName(client, name) })));
    const crowdIds = crowdRes.flatMap((r) => (r.res.status === "resolved" ? [r.res.entityId] : []));
    const score = async (name: string, role: CandidateRow["role"]): Promise<Omit<CandidateRow, "outranksControl">> => {
      const res = await resolveName(client, name);
      if (res.status !== "resolved" || crowdIds.length === 0) {
        return { name, role, resolved: false, fit: null, sharedTags: null, unavailableReason: res.status === "unresolved" ? res.reason : "crowd unresolved" };
      }
      try {
        if (crowdIds.some((id) => id.toLowerCase() === res.entityId.toLowerCase())) {
          return { name, role, resolved: true, fit: null, sharedTags: null, unavailableReason: "candidate-in-crowd" };
        }
        const { data } = await client.compareAudiences(crowdIds, [res.entityId]);
        const fit = computeFit(data);
        return fit.status === "ok"
          ? { name, role, resolved: true, fit: fit.fit, sharedTags: fit.sharedTags, unavailableReason: null }
          : { name, role, resolved: true, fit: null, sharedTags: fit.sharedTags ?? null, unavailableReason: fit.reason };
      } catch (e) {
        return { name, role, resolved: true, fit: null, sharedTags: null, unavailableReason: `compare failed: ${e instanceof Error ? e.constructor.name : "error"}` };
      }
    };
    const scored = await Promise.all(c.sameGenre.map((n) => score(n, "same-genre")));
    const controlScored = await score(c.control, "control");
    const candidates: CandidateRow[] = scored.map((s) => ({
      ...s,
      outranksControl: s.fit !== null && controlScored.fit !== null ? s.fit > controlScored.fit : null,
    }));
    crowds.push({
      id: c.id,
      description: c.description,
      crowd: crowdRes.map((r) => ({ name: r.name, resolved: r.res.status === "resolved" })),
      candidates,
      control: { ...controlScored, outranksControl: null },
      outranking: candidates.filter((x) => x.outranksControl === true).length,
      comparable: candidates.filter((x) => x.outranksControl !== null).length,
    });
  }
  return {
    crowds,
    summary: {
      crowdCount: crowds.length,
      sameGenreCandidates: crowds.reduce((s, c) => s + c.candidates.length, 0),
      comparable: crowds.reduce((s, c) => s + c.comparable, 0),
      outranking: crowds.reduce((s, c) => s + c.outranking, 0),
    },
  };
}
