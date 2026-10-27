import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRuntime } from "../../../src/config";
import { logFailure } from "../../../src/errors";
import { isSlateId } from "../../../src/slateStore";
import { SlateView } from "../../../src/ui/SlateView";
import type { Slate } from "@headliner/core";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

async function loadUncached(id: string): Promise<Slate | null> {
  // The id is validated against the 21-character format before any lookup; anything else is simply "not found".
  if (!isSlateId(id)) return null;
  try {
    return await getRuntime().store.get(id);
  } catch (e) {
    logFailure("slate_read_failed", e);
    throw new Error("slate_read_failed", { cause: e });
  }
}

/** One store read per request: `generateMetadata` and the page share it (the database is a network round trip). */
const load = cache(loadUncached);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const slate = await load(id).catch(() => null);
  return { title: slate ? `Slate for ${slate.room.city}` : "Slate not found", robots: { index: false, follow: false } };
}

export default async function SlatePage({ params }: { params: Params }) {
  const { id } = await params;
  const slate = await load(id);
  if (!slate) notFound();
  return <SlateView slate={slate} ephemeral={getRuntime().mode === "fixtures"} />;
}
