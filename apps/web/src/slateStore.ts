import {
  MemorySlateStore as GenericMemorySlateStore,
  PostgresSlateStore as GenericPostgresSlateStore,
  type Db,
  type SlateStore as GenericSlateStore,
} from "@headliner/slates";
import { SlateSchema, type Slate } from "@headliner/core";

/** The slate store, its ids and the 30-day life live in `@headliner/slates` (M2-04); this file binds them to the core `Slate`. */
export { isSlateId, newSlateId, SLATE_TTL_MS } from "@headliner/slates";

export type SlateStore = GenericSlateStore<Slate>;

/** Fixtures mode: held in process memory, no database (non-persistent). */
export class MemorySlateStore extends GenericMemorySlateStore<Slate> {}

function parseSlate(json: unknown): Slate | null {
  const parsed = SlateSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** Live mode: the `slates` table. */
export class PostgresSlateStore extends GenericPostgresSlateStore<Slate> {
  constructor(db: Db, now?: () => Date) {
    super(db, parseSlate, now);
  }
}
