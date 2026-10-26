import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { deleteRun, getRunJson, putRunJson, RUN_TTL_MS } from "../src/db/runRepo";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

describe("run repo (PGlite)", () => {
  let client: PGlite;
  let db: Db;
  const now = new Date("2026-10-26T12:00:00.000Z");

  beforeAll(async () => {
    client = new PGlite();
    const pg = drizzlePglite(client);
    await migrate(pg, { migrationsFolder });
    db = pg as unknown as Db;
  });
  afterAll(async () => {
    await client.close();
  });

  it("stores a run and returns it while unexpired", async () => {
    await putRunJson(db, "run-a", { id: "run-a" }, now);
    expect(await getRunJson(db, "run-a", new Date(now.getTime() + RUN_TTL_MS - 1))).toEqual({ id: "run-a" });
  });

  it("returns null once the hour is over and for an unknown id", async () => {
    await putRunJson(db, "run-b", { id: "run-b" }, now);
    expect(await getRunJson(db, "run-b", new Date(now.getTime() + RUN_TTL_MS))).toBeNull();
    expect(await getRunJson(db, "nope", now)).toBeNull();
  });

  it("deletes a run", async () => {
    await putRunJson(db, "run-c", { id: "run-c" }, now);
    await deleteRun(db, "run-c");
    expect(await getRunJson(db, "run-c", now)).toBeNull();
  });
});
