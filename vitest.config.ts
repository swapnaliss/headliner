import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    // PGlite starts a WASM Postgres per file; under CPU contention (parallel workers, load average above 10) the
    // default 10 s hook and 5 s test limits flake. Assertions are unchanged (BL-01 6434973808).
    hookTimeout: 90_000,
    testTimeout: 30_000,
    include: ["packages/*/test/**/*.test.ts", "packages/*/src/**/*.test.ts","apps/*/test/**/*.test.{ts,tsx}"],
  },
});
