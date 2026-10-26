import type { Metadata } from "next";
import { getRuntime } from "../../../../src/config";
import { demoMode } from "../../../../src/env";
import { logFailure } from "../../../../src/errors";
import { publicRun } from "../../../../src/pipeline/createSlate";
import { isSlateId } from "../../../../src/slateStore";
import { ConfirmView } from "../../../../src/ui/ConfirmView";
import { EmptyState } from "../../../../src/ui/EmptyState";
import type { Run } from "@headliner/core";

export const dynamic = "force-dynamic";

type Params = Promise<{ runId: string }>;

export const metadata: Metadata = { title: "Confirm the matches", robots: { index: false, follow: false } };

async function load(runId: string): Promise<Run | null> {
  // The id is validated against the 21-character format before any lookup.
  if (!isSlateId(runId)) return null;
  try {
    return await getRuntime().runs.get(runId);
  } catch (e) {
    logFailure("run_read_failed", e);
    throw new Error("run_read_failed", { cause: e });
  }
}

export default async function ConfirmPage({ params }: { params: Params }) {
  const { runId } = await params;
  const run = await load(runId);
  if (!run) {
    return (
      <main id="main" tabIndex={-1} className="main shell">
        <EmptyState
          level={1}
          title="This run is no longer available."
          reason="It may have expired or already been ranked."
          action={
            <a className="btn" data-variant="secondary" href="/">
              Start over
            </a>
          }
        />
      </main>
    );
  }
  const view = publicRun(run);
  return <ConfirmView runId={view.runId} locationDisplay={view.room.locationDisplay} rows={view.matches} demoMode={demoMode() === "fixtures"} />;
}
