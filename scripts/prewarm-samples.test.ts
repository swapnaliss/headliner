import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");
const CANARY = "canary-xyz-123";

function run(args: string[], env: Record<string, string>): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/prewarm-samples.ts", ...args], {
    cwd: ROOT,
    env: { PATH: process.env["PATH"] ?? "", ...env },
    encoding: "utf8",
    timeout: 90_000,
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

describe("scripts/prewarm-samples.ts", () => {
  it("--dry-run replays every room from the recordings and never prints the key (canary)", () => {
    const { status, out } = run(["--dry-run"], { CANARY_KEY: CANARY, QLOO_API_KEY: CANARY, DATABASE_URL: `postgres://u:${CANARY}@localhost/none` });
    expect(status).toBe(0);
    expect(out).toContain("dry run ok: no network, no database");
    expect(out.split(CANARY).length - 1).toBe(0);
    expect(out.toLowerCase()).not.toContain("x-api-key");
  }, 120_000);

  it("a live run without a key fails with a fixed message and prints nothing sensitive", () => {
    const { status, out } = run(["--write-db"], { DATABASE_URL: `postgres://u:${CANARY}@localhost/none` });
    expect(status).toBe(1);
    expect(out).toContain("prewarm failed");
    expect(out.split(CANARY).length - 1).toBe(0);
  }, 120_000);

  it("asks for a mode when none is given", () => {
    const { status, out } = run([], {});
    expect(status).toBe(1);
    expect(out).toContain("choose --dry-run");
  }, 120_000);
});
