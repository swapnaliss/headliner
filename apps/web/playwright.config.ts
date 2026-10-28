import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests run against the production build in DEMO_MODE=fixtures with no keys, no database
 * and no LLM. Build first (`npm run build -w apps/web`), then `npm run e2e -w apps/web`.
 *
 * A second server (PORT + 1) serves the picker screen. No ambiguous search is recorded in
 * `fixtures/qloo` yet (BL-01), so the harness copies the recordings to a temp directory and
 * answers the unaccented query "Bjork" with the recorded response for "Björk" (a real Qloo
 * response whose top hit differs from the typed name). Test harness only: the repository's
 * fixtures are not changed and the product path never reads this copy.
 */
const PORT = Number(process.env["E2E_PORT"] ?? 3100);
export const PICKER_PORT = PORT + 1;

function pickerFixtures(): string {
  const source = resolve(__dirname, "../../fixtures/qloo");
  const target = join(tmpdir(), `headliner-e2e-picker-${PORT}`);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  const index = JSON.parse(readFileSync(join(source, "index.json"), "utf8")) as Record<string, string>;
  index["/search?query=Bjork&take=5&types=urn%3Aentity%3Aartist"] = "search--bjork.json";
  writeFileSync(join(target, "index.json"), JSON.stringify(index, null, 2));
  return target;
}

/** A fresh clone has no production build yet; build once (fixtures mode, no keys) before the first server starts. */
const BUILD_IF_MISSING = "test -f .next/BUILD_ID || npx next build && ";

const env = { DEMO_MODE: "fixtures", QLOO_API_KEY: "", OPENAI_API_KEY: "", DATABASE_URL: "" };

export default defineConfig({
  // Absolute, so the same config also works when loaded through the repository root `playwright.config.ts`
  // (the M3-06 gate runs `npx playwright test apps/web/tests/...` from the root).
  testDir: __dirname,
  testMatch: ["e2e/**/*.spec.ts", "tests/**/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: `${BUILD_IF_MISSING}npx next start -p ${PORT} -H 127.0.0.1`,
      cwd: __dirname,
      url: `http://127.0.0.1:${PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 240_000,
      env,
    },
    {
      command: `npx next start -p ${PICKER_PORT} -H 127.0.0.1`,
      cwd: __dirname,
      url: `http://127.0.0.1:${PICKER_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ...env, FIXTURES_DIR: pickerFixtures() },
    },
  ],
});
