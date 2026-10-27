import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Slate } from "@headliner/core";
import { buildActDetail, decodeActId, type ActDetail } from "../../../../../src/actDetail";
import { getRuntime } from "../../../../../src/config";
import { logFailure } from "../../../../../src/errors";
import { isSlateId } from "../../../../../src/slateStore";
import { CityStrengthSection } from "./CityStrengthSection";
import { ActDetailView } from "../../../../../src/ui/ActDetailView";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; actId: string }>;

interface Loaded {
  detail: ActDetail;
  city: string;
  cityStrengths: Slate["results"][number]["cityStrengths"];
  evidence: Slate["results"][number]["evidence"];
}

async function loadUncached(id: string, actId: string): Promise<Loaded | null> {
  // Both route values are untrusted: the slate id is format-checked and the act id is matched by equality against the slate.
  if (!isSlateId(id)) return null;
  try {
    const slate = await getRuntime().store.get(id);
    if (!slate) return null;
    const detail = buildActDetail(slate, decodeActId(actId));
    const result = detail ? slate.results.find((r) => r.act.qlooEntityId === detail.act.entityId) : undefined;
    return detail && result ? { detail, city: slate.room.city, cityStrengths: result.cityStrengths, evidence: result.evidence } : null;
  } catch (e) {
    logFailure("act_detail_read_failed", e);
    throw new Error("act_detail_read_failed", { cause: e });
  }
}

/** One store read per request: `generateMetadata` and the page share it (the database is a network round trip). */
const load = cache(loadUncached);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, actId } = await params;
  const loaded = await load(id, actId).catch(() => null);
  return { title: loaded ? loaded.detail.act.name : "Act not found", robots: { index: false, follow: false } };
}

export default async function ActDetailPage({ params }: { params: Params }) {
  const { id, actId } = await params;
  const loaded = await load(id, actId);
  if (!loaded) notFound();
  const { detail } = loaded;
  return (
    <ActDetailView
      detail={detail}
      citiesSlot={
        detail.act.entityId.startsWith("unmatched:") ? undefined : (
        <CityStrengthSection
          slateId={detail.slateId}
          actId={detail.act.entityId}
          actName={detail.act.name}
          roomCity={loaded.city}
          persisted={loaded.cityStrengths}
          persistedEvidence={loaded.evidence}
        />
        )
      }
    />
  );
}
