import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildActDetail, decodeActId, type ActDetail } from "../../../../../src/actDetail";
import { getRuntime } from "../../../../../src/config";
import { logFailure } from "../../../../../src/errors";
import { isSlateId } from "../../../../../src/slateStore";
import { ActDetailView } from "../../../../../src/ui/ActDetailView";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; actId: string }>;

async function load(id: string, actId: string): Promise<ActDetail | null> {
  // Both route values are untrusted: the slate id is format-checked and the act id is matched by equality against the slate.
  if (!isSlateId(id)) return null;
  try {
    const slate = await getRuntime().store.get(id);
    return slate ? buildActDetail(slate, decodeActId(actId)) : null;
  } catch (e) {
    logFailure("act_detail_read_failed", e);
    throw new Error("act_detail_read_failed", { cause: e });
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, actId } = await params;
  const detail = await load(id, actId).catch(() => null);
  return { title: detail ? detail.act.name : "Act not found", robots: { index: false, follow: false } };
}

export default async function ActDetailPage({ params }: { params: Params }) {
  const { id, actId } = await params;
  const detail = await load(id, actId);
  if (!detail) notFound();
  return <ActDetailView detail={detail} />;
}
