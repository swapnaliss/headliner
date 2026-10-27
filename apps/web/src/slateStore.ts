import {
  isSlateId as isNanoId,
  MemorySlateStore as GenericMemorySlateStore,
  PostgresSlateStore as GenericPostgresSlateStore,
  type Db,
  type SlateStore as GenericSlateStore,
} from "@headliner/slates";
import { SlateSchema, type Slate } from "@headliner/core";
import { isSampleId } from "./sampleId";

/** The slate store, its ids and the 30-day life live in `@headliner/slates` (M2-04); this file binds them to the core `Slate`. */
export { newSlateId, SLATE_TTL_MS } from "@headliner/slates";

/**
 * True for a 21-character nanoid-alphabet id, or for a pinned sample id (`sample-<slug>`, M2-06).
 * Checked before any lookup. No request can create a sample id: only the prewarm script stores one.
 */
export function isSlateId(value: string): boolean {
  return isNanoId(value) || isSampleId(value);
}

export type SlateStore = GenericSlateStore<Slate>;

/** Fixtures mode: held in process memory, no database (non-persistent). */
export class MemorySlateStore extends GenericMemorySlateStore<Slate> {
  constructor(now?: () => Date) {
    super(now, isSlateId);
  }
}

function parseSlate(json: unknown): Slate | null {
  const parsed = SlateSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** Live mode: the `slates` table. */
export class PostgresSlateStore extends GenericPostgresSlateStore<Slate> {
  constructor(db: Db, now?: () => Date) {
    super(db, parseSlate, now, isSlateId);
  }
}
