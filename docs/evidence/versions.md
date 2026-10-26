# Version check

Checked 2026-10-26 with `npm view <pkg> version time --json` (registry latest and its publish date).

| Package | Pinned in PROJECT.md §4 | Registry latest | Published | Used |
|---|---|---|---|---|
| next | 16.4.3 | 16.4.3 | 2026-10-23 | 16.4.3 |
| typescript | 7.0.2 | 7.0.2 | 2026-07-08 | **5.9.3 (fallback)** |
| zod | 4.6.7 | 4.6.7 | 2026-10-12 | 4.6.7 |
| drizzle-orm | 0.45.4 | 0.45.4 | 2026-10-08 | not installed yet (M0-05) |
| openai (replaces @anthropic-ai/sdk, owner decision 2026-10-26) | 7.43.0 | 7.43.0 | 2026-10-22 | not installed yet (M3-01) |
| vitest | 5.0.5 | 5.0.5 | 2026-10-15 | 5.0.5 |

Tooling pins that were not in the table: eslint 10.13.0, typescript-eslint 8.72.0, prettier 3.9.10, react and react-dom 19.3.1.

## Fallback taken: TypeScript 7.0.2 to 5.9.3

`npm install` refused the tree before any build ran:

```
npm error peer typescript@">=4.8.4 <6.1.0" from typescript-eslint@8.72.0
npm error Found: typescript@7.0.2
```

typescript-eslint 8.72.0 (latest) supports TypeScript below 6.1, so linting cannot run on 7.x. ADR 0011 allows stepping back to the latest 5.x; 5.9.3 (published 2025-09-30) is the latest 5.x. `npm run check` passes on it. PROJECT.md §4 is updated to match. Revisit when typescript-eslint supports 7.
