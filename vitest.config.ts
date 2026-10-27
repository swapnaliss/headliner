import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["packages/*/test/**/*.test.ts", "packages/*/src/**/*.test.ts", "apps/*/test/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
