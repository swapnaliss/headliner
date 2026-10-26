import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/coverage/**", "apps/web/next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*"], message: "packages/core must not import a framework." },
            { group: ["node:*"], message: "packages/core must not import Node built-ins." },
            { group: ["pg", "pg/*"], message: "packages/core must not import a database driver." },
          ],
        },
      ],
    },
  },
);
