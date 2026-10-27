import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Slate } from "@headliner/core";
import { getRuntime } from "../../../src/config";
import { logFailure } from "../../../src/errors";
import { isSlateId } from "../../../src/slateStore";
import { ExplanationBlock } from "../../../src/ui/ExplanationBlock";
import { SlateView } from "../../../src/ui/SlateView";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/** The shared, read-only slate (ADR 0008). A malformed id never reaches the store; unknown and expired look the same. */
async function loadUncached(id: string): Promise<Slate | null> {
  if (!isSlateId(id)) return null;
  try {
    return await getRuntime().store.get(id);
  } catch (e) {
    logFailure("shared_slate_read_failed", e);
    throw new Error("shared_slate_read_failed", { cause: e });
  }
}

/** One store read per request: `generateMetadata` and the page share it (the database is a network round trip). */
const load = cache(loadUncached);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const slate = await load(id).catch(() => null);
  return { title: slate ? `Shared slate for ${slate.room.city}` : "Slate not found", robots: { index: false, follow: false } };
}

export default async function SharedSlatePage({ params }: { params: Params }) {
  const { id } = await params;
  const slate = await load(id);
  if (!slate) notFound();
  return <SlateView slate={slate} shared explanation={<ExplanationBlock slate={slate} />} />;
}
