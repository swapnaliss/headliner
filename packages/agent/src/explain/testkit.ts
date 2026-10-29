import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SlateSchema, type Slate } from "@headliner/core";

/** Test helpers: recorded slates and stub model replies from fixtures/agent/explain. Not exported from the package index. */
const DIR = fileURLToPath(new URL("../../../../fixtures/agent/explain/", import.meta.url));

export function loadSlate(id: "sample-leipzig-indie" | "sample-berlin-electronic"): Slate {
  return SlateSchema.parse(JSON.parse(readFileSync(`${DIR}slate--${id}.json`, "utf8")));
}

/** The raw model text of a recorded stub reply. */
export function loadReply(name: "live-slate" | "live-act" | "live-act-rejected" | "ungrounded" | "berlin-slate" | "berlin-act"): string {
  const parsed: unknown = JSON.parse(readFileSync(`${DIR}model-reply--${name}.json`, "utf8"));
  if (typeof parsed !== "object" || parsed === null || typeof (parsed as { text?: unknown }).text !== "string") throw new Error("bad reply fixture");
  return (parsed as { text: string }).text;
}

/** A copy of the slate with one act's name replaced (for injection and markup cases). */
export function withActName(slate: Slate, index: number, name: string): Slate {
  return { ...slate, results: slate.results.map((r, i) => (i === index ? { ...r, act: { ...r.act, name } } : r)) };
}
