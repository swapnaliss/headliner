import { expect, test, type Locator } from "@playwright/test";

const PICKER = `http://127.0.0.1:${Number(process.env["E2E_PORT"] ?? 3100) + 1}`;

/** Below 768px every control is at least 44 by 44 CSS px (design-system.md section 6, --target). */
async function expectTarget(locator: Locator, label: string): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, `${label} is on screen`).not.toBeNull();
  expect(box?.height ?? 0, `${label} height`).toBeGreaterThanOrEqual(43.5);
  expect(box?.width ?? 0, `${label} width`).toBeGreaterThanOrEqual(43.5);
}

test.describe("44px targets at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("slate card links, act detail evidence links and city rows", async ({ page }) => {
    await page.goto("/s/sample-berlin-electronic");
    const card = page.locator("article").first();
    await expectTarget(card.getByRole("link", { name: /^Open details for/ }), "Open details");
    await expectTarget(card.getByRole("link", { name: /^Evidence for/ }), "Evidence (n calls)");
    await card.getByRole("link", { name: /^Open details for/ }).click();
    await page.waitForURL(/\/act\//);
    for (const link of await page.locator(".evidence-links a").all()) await expectTarget(link, "See evidence number");
    await page.locator("#cities").scrollIntoViewIfNeeded();
    for (const link of await page.locator(".city-evidence-link").all()) await expectTarget(link, "city See evidence");
  });

  test.describe("confirm screen", () => {
    test.use({ baseURL: PICKER });
    test("Go to the first one, Back to edit the room, Remove act and Rank", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Fill in the sample room" }).click();
      await page.locator("#candidate-input").fill("Bjork");
      await page.locator("#candidate-input").press("Enter");
      await page.locator("#rank-button").click();
      await page.waitForURL(/\/confirm$/);
      await expectTarget(page.getByRole("button", { name: "Go to the first one" }), "Go to the first one");
      await expectTarget(page.getByRole("link", { name: "Back to edit the room" }), "Back to edit the room");
      await expectTarget(page.getByRole("button", { name: "Remove act" }).first(), "Remove act");
      await expectTarget(page.getByRole("button", { name: "Rank these acts" }), "Rank these acts");
    });
  });
});
