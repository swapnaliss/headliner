import type { Db } from "./db/client";
import { deleteSlate, getSlateRow, insertSlate, patchSlateJson, updateSlateJson } from "./db/slateRepo";
import { isSlateId, SLATE_TTL_MS } from "./id";

/** A slate as the store sees it: any JSON-able value with an id. The parser decides what is valid. */
export interface Identified {
  readonly id: string;
}

export interface SlateStore<T extends Identified> {
  save(slate: T): Promise<void>;
  /** The slate for a valid id, or null when unknown, malformed or expired (the cases are indistinguishable). */
  get(id: string): Promise<T | null>;
  /** Replaces the stored slate (lazy city strength adds aggregates, M2-03). False when it is unknown or expired. */
  update(slate: T): Promise<boolean>;
  /**
   * Atomic read-modify-write: `patch` gets the current slate and returns the replacement, or null to
   * write nothing. Concurrent calls (even from another instance) are serialised per slate, so none
   * overwrites another's change (BL-01 6434847617). False when unknown, expired, unparsable or unchanged.
   */
  updateWith(id: string, patch: (current: T) => T | null): Promise<boolean>;
}

/** Fixtures mode: held in process memory with the same 30-day life, no database. */
export class MemorySlateStore<T extends Identified> implements SlateStore<T> {
  private readonly items = new Map<string, { value: T; expiresAt: number }>();
  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly validId: (id: string) => boolean = isSlateId,
  ) {}
  async save(slate: T): Promise<void> {
    this.items.set(slate.id, { value: slate, expiresAt: this.now().getTime() + SLATE_TTL_MS });
  }
  async get(id: string): Promise<T | null> {
    if (!this.validId(id)) return null;
    const item = this.items.get(id);
    if (!item) return null;
    if (item.expiresAt <= this.now().getTime()) {
      this.items.delete(id);
      return null;
    }
    return item.value;
  }
  async update(slate: T): Promise<boolean> {
    const item = this.items.get(slate.id);
    if (!item || item.expiresAt <= this.now().getTime()) return false;
    this.items.set(slate.id, { value: slate, expiresAt: item.expiresAt });
    return true;
  }
  async updateWith(id: string, patch: (current: T) => T | null): Promise<boolean> {
    // One process, no await between read and write: nothing can interleave.
    const item = this.items.get(id);
    if (!item || item.expiresAt <= this.now().getTime()) return false;
    const next = patch(item.value);
    if (next === null) return false;
    this.items.set(id, { value: next, expiresAt: item.expiresAt });
    return true;
  }
}

/** Stores a slate with `expires_at = created_at + 30 days` and returns its id. */
export async function saveSlate<T extends Identified>(db: Db, slate: T, now: Date = new Date()): Promise<string> {
  await insertSlate(db, slate.id, slate, now, new Date(now.getTime() + SLATE_TTL_MS));
  return slate.id;
}

/**
 * Loads a slate. A malformed id returns null before any query; an expired row returns null and is
 * deleted on the way out (lazy expiry). A row that fails `parse` is treated as unknown.
 */
export async function loadSlate<T extends Identified>(db: Db, id: string, parse: (json: unknown) => T | null, now: Date = new Date(), validId: (id: string) => boolean = isSlateId): Promise<T | null> {
  if (!validId(id)) return null;
  const row = await getSlateRow(db, id);
  if (!row) return null;
  if (row.expiresAt.getTime() <= now.getTime()) {
    await deleteSlate(db, id, now);
    return null;
  }
  return parse(row.json);
}

/** Live mode: the `slates` table (M0-05). The stored value is the Slate JSON, nothing else. */
export class PostgresSlateStore<T extends Identified> implements SlateStore<T> {
  constructor(
    private readonly db: Db,
    private readonly parse: (json: unknown) => T | null,
    private readonly now: () => Date = () => new Date(),
    private readonly validId: (id: string) => boolean = isSlateId,
  ) {}
  async save(slate: T): Promise<void> {
    await saveSlate(this.db, slate, this.now());
  }
  async get(id: string): Promise<T | null> {
    return loadSlate(this.db, id, this.parse, this.now(), this.validId);
  }
  async update(slate: T): Promise<boolean> {
    return updateSlateJson(this.db, slate.id, slate, this.now());
  }
  async updateWith(id: string, patch: (current: T) => T | null): Promise<boolean> {
    if (!this.validId(id)) return false;
    return patchSlateJson(
      this.db,
      id,
      (json) => {
        const current = this.parse(json);
        return current === null ? null : patch(current);
      },
      this.now(),
    );
  }
}
