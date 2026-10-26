import { randomBytes } from "node:crypto";
import type { Db } from "@headliner/slates";
import { getSlateJson, slates, updateSlateJson } from "@headliner/slates";
import { SlateSchema, type Slate } from "@headliner/core";

/** Shareable slates live 30 days (ADR 0003). */
export const SLATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

/** 21 URL-safe characters from the CSPRNG (the nanoid(21) format; 64 symbols so no modulo bias). */
export function newSlateId(): string {
  const bytes = randomBytes(21);
  let id = "";
  for (const b of bytes) id += ALPHABET[b & 63];
  return id;
}

export interface SlateStore {
  save(slate: Slate): Promise<void>;
  /** The slate for a valid id, or null when unknown or expired. */
  get(id: string): Promise<Slate | null>;
  /** Replaces the stored slate (lazy city strength adds aggregates, M2-03). False when it is unknown or expired. */
  update(slate: Slate): Promise<boolean>;
}

/** Fixtures mode: held in process memory, no database. */
export class MemorySlateStore implements SlateStore {
  private readonly items = new Map<string, Slate>();
  async save(slate: Slate): Promise<void> {
    this.items.set(slate.id, slate);
  }
  async get(id: string): Promise<Slate | null> {
    return this.items.get(id) ?? null;
  }
  async update(slate: Slate): Promise<boolean> {
    if (!this.items.has(slate.id)) return false;
    this.items.set(slate.id, slate);
    return true;
  }
}

/** True for the 21-character nanoid-alphabet ids `newSlateId` produces. Checked before any lookup. */
export function isSlateId(value: string): boolean {
  return /^[A-Za-z0-9_-]{21}$/.test(value);
}

/** Live mode: the `slates` table (M0-05). The stored value is the Slate JSON, nothing else. */
export class PostgresSlateStore implements SlateStore {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async save(slate: Slate): Promise<void> {
    const created = this.now();
    await this.db.insert(slates).values({ id: slate.id, json: slate, createdAt: created, expiresAt: new Date(created.getTime() + SLATE_TTL_MS) });
  }
  async get(id: string): Promise<Slate | null> {
    if (!isSlateId(id)) return null;
    const json = await getSlateJson(this.db, id, this.now());
    if (json === null) return null;
    const parsed = SlateSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  }
  async update(slate: Slate): Promise<boolean> {
    return updateSlateJson(this.db, slate.id, slate, this.now());
  }
}
