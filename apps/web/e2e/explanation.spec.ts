import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const BANNER = "aggregate affinity, not a ticket forecast";

/**
 * The page streams a pending template block (the Suspense fallback), then the settled block. Until React swaps
 * them, the HTML holds both: the fallback and the final block inside a hidden node. Only the settled block
 * counts, so this locator names exactly one element once the swap has run (#28).
 */
const settledExplanation = (page: Page) => page.locator('[data-testid="explanation"][data-state="settled"]');

test.describe("Explanation block (recorded mode, no LLM key)", () => {
  test("the sample slate shows the template explanation under the banner, with its source label", async ({ page }) => {
    await page.goto("/s/sample-leipzig-indie");
    const block = settledExplanation(page);
    await expect(block).toBeVisible();
    await expect(block).toHaveAttribute("data-source", "template");
    await expect(block.getByRole("heading", { level: 2, name: "Explanation" })).toBeVisible();
    await expect(block.getByTestId("explanation-source")).toContainText("Template.");
    await expect(block).toContainText("Moderat ranks 1 with an audience-taste fit of 63.8");
    await expect(page.getByText(BANNER).first()).toBeVisible();
    await expect(block).not.toContainText(/forecast|turnout|will sell/i);
  });

  test("once settled, exactly one Explanation region is visible and none is pending", async ({ page }) => {
    await page.goto("/s/sample-leipzig-indie");
    await expect(settledExplanation(page)).toBeVisible();
    await expect(page.locator('[data-testid="explanation"][data-state="pending"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="explanation"]:visible')).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Explanation" })).toHaveCount(1);
  });

  test("the act detail explains that act only", async ({ page }) => {
    await page.goto("/s/sample-leipzig-indie");
    await page.locator("article").nth(1).getByRole("link").first().click();
    const block = settledExplanation(page);
    await expect(block).toContainText("Apparat ranks 2");
    await expect(block).not.toContainText("Moderat ranks 1");
  });

  test("axe finds nothing serious on the slate and the act detail", async ({ page }) => {
    for (const path of ["/s/sample-leipzig-indie", "/s/sample-berlin-electronic"]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    }
  });
});
