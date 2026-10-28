import { expect, test } from "@playwright/test";
import { expectPageBasics, noHorizontalOverflow, scan, SCHEMES, WIDTHS } from "../support";
import { SCENES } from "./scenes";

/**
 * M3-06 accessibility sweep: every route and state the fixtures can reproduce (DEMO_MODE=fixtures, no keys),
 * in light and dark, at 360 px and 1280 px. Each page must have zero serious or critical axe violations, the
 * Banner, the landmark and heading structure, and no horizontal scroll at 360 px.
 */
for (const scene of SCENES) {
  for (const scheme of SCHEMES) {
    for (const width of WIDTHS) {
      test(`${scene.name} · ${scheme} · ${width}px`, async ({ browser, baseURL }) => {
        const context = await browser.newContext({
          baseURL: scene.origin ?? baseURL ?? "http://127.0.0.1:3100",
          viewport: { width, height: width < 600 ? 780 : 900 },
          colorScheme: scheme,
        });
        try {
          const page = await context.newPage();
          await scene.open({ page, request: context.request });
          await expectPageBasics(page);
          const result = await scan(page);
          if (result.moderateOrMinor.length > 0) test.info().annotations.push({ type: "axe-moderate-minor", description: result.moderateOrMinor.join("; ") });
          expect(result.blocking).toEqual([]);
          if (width === 360) expect(await noHorizontalOverflow(page), "horizontal scroll at 360px").toBe(true);
        } finally {
          await context.close();
        }
      });
    }
  }
}
