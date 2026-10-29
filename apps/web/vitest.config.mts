import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: [{ find: /^next\/font\/local$/, replacement: fileURLToPath(new URL("test/stubs/next-font-local.ts", import.meta.url)) }] },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
