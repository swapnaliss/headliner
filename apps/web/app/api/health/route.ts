import { demoMode } from "../../../src/env";

export const dynamic = "force-dynamic";

type DbStatus = "ok" | "unavailable" | "skipped";

/** Reports reachability only: never a connection string, host or driver error text. */
async function dbStatus(): Promise<DbStatus> {
  if (!process.env["DATABASE_URL"]) return "skipped";
  try {
    // Imported lazily so the zero-key fixtures path never loads the database driver.
    const { pingDb } = await import("@headliner/slates");
    await pingDb();
    return "ok";
  } catch {
    return "unavailable";
  }
}

export async function GET(request: Request): Promise<Response> {
  const base = { ok: true, mode: demoMode(), version: "0.1.0" };
  if (new URL(request.url).searchParams.get("deep") === "1") {
    return Response.json({ ...base, db: await dbStatus() });
  }
  return Response.json(base);
}
