import type { ActResult, Slate } from "@headliner/core";
import { createSlate } from "../../src/pipeline/createSlate";
import { fixtureTransport, ROOM, runtimeWith } from "../helpers";

/** The real slate for the recorded Berlin room (Khruangbin, Radiohead, Reality Club scored; Hindia no-data), built from the fixtures. */
export async function recordedSlate(): Promise<Slate> {
  const outcome = await createSlate(ROOM, runtimeWith(fixtureTransport()));
  if (outcome.status !== "done") throw new Error("expected a done slate");
  return outcome.slate;
}

export function withName(result: ActResult, name: string): ActResult {
  return { ...result, act: { ...result.act, name } };
}
