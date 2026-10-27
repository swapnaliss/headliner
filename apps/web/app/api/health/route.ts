import { demoMode } from "../../../src/env";
import { logged } from "../../../src/log";

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

async function handleGET(request: Request): Promise<Response> {
  const base = { ok: true, mode: demoMode(), version: "0.1.0" };
  if (new URL(request.url).searchParams.get("deep") === "1") {
    const db = await dbStatus();
    // An unreachable database answers 503, so a monitor that only checks the status code still alerts.
    return Response.json(db === "unavailable" ? { ...base, ok: false, db } : { ...base, db }, { status: db === "unavailable" ? 503 : 200 });
  }
  return Response.json(base);
}

export const GET = logged("GET /api/health", handleGET);
