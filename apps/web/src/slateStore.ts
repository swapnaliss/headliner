import { randomBytes } from "node:crypto";
import type { Db } from "@headliner/slates";
import { slates } from "@headliner/slates";
import type { Slate } from "@headliner/core";

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
}

/** Live mode: the `slates` table (M0-05). The stored value is the Slate JSON, nothing else. Reads are the share page (M2-04). */
export class PostgresSlateStore implements SlateStore {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async save(slate: Slate): Promise<void> {
    const created = this.now();
    await this.db.insert(slates).values({ id: slate.id, json: slate, createdAt: created, expiresAt: new Date(created.getTime() + SLATE_TTL_MS) });
  }
}
