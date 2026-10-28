import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "@playwright/test";
import { SCENES } from "../a11y/scenes";
import { scan, SCHEMES } from "../support";

/**
 * Evidence capture, not part of the gate: runs only with CAPTURE=1.
 *   .review/M3-06/  (local, gitignored): every scene at 375 / 768 / 1440, light and dark, plus axe JSON.
 *   docs/screenshots/ (tracked): slate and act detail at 360 / 390 / 768 / 1280 (M3-06 AC, README and Devpost use them).
 */
const CAPTURE = process.env["CAPTURE"] === "1";
const REVIEW_DIR = resolve(__dirname, "../../../../.review/M3-06");
const DOCS_DIR = resolve(__dirname, "../../../../docs/screenshots");
const REVIEW_WIDTHS = [375, 768, 1440] as const;
const DOC_WIDTHS = [360, 390, 768, 1280] as const;
const DOC_NAMES: Record<string, string> = { "slate-ranked": "slate", "act-ranked": "act-detail" };

test.describe("capture", () => {
  test.skip(!CAPTURE, "set CAPTURE=1 to capture screenshots");
  test.setTimeout(900_000);

  test("review set and documentation set", async ({ browser, baseURL }) => {
    mkdirSync(REVIEW_DIR, { recursive: true });
    mkdirSync(DOCS_DIR, { recursive: true });
    const axe: Record<string, { blocking: string[]; moderateOrMinor: string[] }> = {};
    for (const scene of SCENES) {
      for (const scheme of SCHEMES) {
        for (const width of REVIEW_WIDTHS) {
          const context = await browser.newContext({ baseURL: scene.origin ?? baseURL ?? "", viewport: { width, height: width < 600 ? 780 : 900 }, colorScheme: scheme });
          try {
            const page = await context.newPage();
            await scene.open({ page, request: context.request });
            await page.screenshot({ path: join(REVIEW_DIR, `${scene.name}-${width}-${scheme}.png`), fullPage: true });
            axe[`${scene.name}-${width}-${scheme}`] = await scan(page);
          } finally {
            await context.close();
          }
        }
      }
    }
    writeFileSync(join(REVIEW_DIR, "axe-results.json"), JSON.stringify(axe, null, 2));
    for (const scene of SCENES.filter((s) => DOC_NAMES[s.name])) {
      for (const width of DOC_WIDTHS) {
        const context = await browser.newContext({ baseURL: baseURL ?? "", viewport: { width, height: width < 600 ? 780 : 900 }, colorScheme: "light" });
        try {
          const page = await context.newPage();
          await scene.open({ page, request: context.request });
          await page.screenshot({ path: join(DOCS_DIR, `${DOC_NAMES[scene.name]}-${width}.png`), fullPage: true });
        } finally {
          await context.close();
        }
      }
    }
  });
});
