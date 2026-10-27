import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/coverage/**", "apps/web/next-env.d.ts", ".claude/**", ".review/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Domain core (ADR 0001): pure, no I/O. Source may import only `zod` and itself.
    files: ["packages/core/src/**/*.ts"],
    ignores: ["packages/core/src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!zod$|\\./)",
              message: "packages/core may import only zod and itself (no framework, Node built-ins, drivers or SDKs).",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "packages/core does no I/O." },
        { name: "process", message: "packages/core reads no environment." },
      ],
    },
  },
);
