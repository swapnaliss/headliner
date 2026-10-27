import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { slates } from "../src/db/schema";
import { isSlateId, newSlateId, SLATE_TTL_MS } from "../src/id";
import { loadSlate, MemorySlateStore, PostgresSlateStore, saveSlate } from "../src/store";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const parse = (json: unknown): { id: string; n: number } | null => (typeof json === "object" && json !== null && "id" in json && "n" in json ? (json as { id: string; n: number }) : null);

describe("slate ids", () => {
  it("are 21 characters from the nanoid alphabet and 1,000 of them do not collide", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = newSlateId();
      expect(id).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(isSlateId(id)).toBe(true);
      ids.add(id);
    }
    expect(ids.size).toBe(1000);
  });

  it.each([
    ["22 characters", "a".repeat(22)],
    ["20 characters", "a".repeat(20)],
    ["path traversal", "../../etc/passwd/aaaaaa"],
    ["SQL metacharacters", "' OR 1=1; DROP TABLE"],
    ["a space", "aaaaaaaaaaaaaaaaaaaa "],
    ["empty", ""],
  ])("rejects %s", (_label, value) => {
    expect(isSlateId(value)).toBe(false);
  });
});

describe("a malformed id never reaches the database", () => {
  it("loadSlate returns null without a single query", async () => {
    let queries = 0;
    // A stub whose every property access counts as a query: any use of the database fails the assertion.
    const stub = new Proxy({}, { get: () => { queries++; throw new Error("database touched"); } }) as unknown as Db;
    for (const id of ["a".repeat(22), "../../etc/passwd", "x' OR '1'='1", "", "a".repeat(20)]) {
      expect(await loadSlate(stub, id, parse)).toBeNull();
    }
    expect(queries).toBe(0);
    expect(await new PostgresSlateStore(stub, parse).get("a".repeat(22))).toBeNull();
    expect(queries).toBe(0);
  });
});

describe("saveSlate and loadSlate (PGlite)", () => {
  let client: PGlite;
  let db: Db;
  beforeAll(async () => {
    client = new PGlite();
    const pg = drizzlePglite(client);
    await migrate(pg, { migrationsFolder });
    db = pg as unknown as Db;
  }, 60_000);
  afterAll(async () => {
    await client.close();
  });

  it("saves with expires_at = created_at + 30 days and returns the id", async () => {
    const now = new Date("2026-10-26T12:00:00.000Z");
    const slate = { id: newSlateId(), n: 1 };
    expect(await saveSlate(db, slate, now)).toBe(slate.id);
    const rows = await db.select().from(slates);
    const row = rows.find((r) => r.id === slate.id);
    expect(row?.createdAt.getTime()).toBe(now.getTime());
    expect((row?.expiresAt.getTime() ?? 0) - (row?.createdAt.getTime() ?? 0)).toBe(SLATE_TTL_MS);
    expect(SLATE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("returns null for an unknown id and for an expired one, and deletes the expired row on read (fake clock)", async () => {
    const created = new Date("2026-10-26T12:00:00.000Z");
    const slate = { id: newSlateId(), n: 2 };
    await saveSlate(db, slate, created);
    const justBefore = new Date(created.getTime() + SLATE_TTL_MS - 1);
    const atExpiry = new Date(created.getTime() + SLATE_TTL_MS);
    expect(await loadSlate(db, slate.id, parse, justBefore)).toEqual(slate);
    expect(await loadSlate(db, newSlateId(), parse, justBefore)).toBeNull();
    expect((await db.select().from(slates)).some((r) => r.id === slate.id)).toBe(true);
    expect(await loadSlate(db, slate.id, parse, atExpiry)).toBeNull();
    expect((await db.select().from(slates)).some((r) => r.id === slate.id)).toBe(false);
  });

  it("treats a row that does not parse as unknown", async () => {
    const id = newSlateId();
    await saveSlate(db, { id, bad: true }, new Date());
    expect(await loadSlate(db, id, parse)).toBeNull();
  });
});

describe("MemorySlateStore (fixtures mode)", () => {
  it("has the same 30-day life and the same null for unknown, malformed and expired ids", async () => {
    let t = new Date("2026-10-26T12:00:00.000Z");
    const store = new MemorySlateStore<{ id: string; n: number }>(() => t);
    const slate = { id: newSlateId(), n: 1 };
    await store.save(slate);
    expect(await store.get(slate.id)).toEqual(slate);
    expect(await store.get(newSlateId())).toBeNull();
    expect(await store.get("a".repeat(22))).toBeNull();
    expect(await store.update({ ...slate, n: 2 })).toBe(true);
    expect((await store.get(slate.id))?.n).toBe(2);
    expect(await store.updateWith(slate.id, (c) => ({ ...c, n: c.n + 1 }))).toBe(true);
    expect((await store.get(slate.id))?.n).toBe(3);
    expect(await store.updateWith(slate.id, () => null)).toBe(false);
    t = new Date(t.getTime() + SLATE_TTL_MS);
    expect(await store.updateWith(slate.id, (c) => ({ ...c, n: 9 }))).toBe(false);
    expect(await store.update({ ...slate, n: 3 })).toBe(false);
    expect(await store.get(slate.id)).toBeNull();
  });
});
