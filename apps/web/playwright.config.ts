import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests run against the production build in DEMO_MODE=fixtures with no keys, no database
 * and no LLM. Build first (`npm run build -w apps/web`), then `npm run e2e -w apps/web`.
 */
const PORT = Number(process.env["E2E_PORT"] ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npx next start -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DEMO_MODE: "fixtures", QLOO_API_KEY: "", ANTHROPIC_API_KEY: "", DATABASE_URL: "" },
  },
});
