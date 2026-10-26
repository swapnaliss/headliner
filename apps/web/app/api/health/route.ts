import { demoMode } from "../../../src/env";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ ok: true, mode: demoMode(), version: "0.1.0" });
}
