import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const BANNER = "aggregate affinity, not a ticket forecast";

test.describe("Explanation block (recorded mode, no LLM key)", () => {
  test("the sample slate shows the template explanation under the banner, with its source label", async ({ page }) => {
    await page.goto("/s/sample-leipzig-indie");
    const block = page.getByTestId("explanation");
    await expect(block).toBeVisible();
    await expect(block).toHaveAttribute("data-source", "template");
    await expect(block.getByRole("heading", { level: 2, name: "Explanation" })).toBeVisible();
    await expect(block.getByTestId("explanation-source")).toContainText("Template.");
    await expect(block).toContainText("Moderat ranks 1 with an audience-taste fit of 63.8");
    await expect(page.getByText(BANNER).first()).toBeVisible();
    await expect(block).not.toContainText(/forecast|turnout|will sell/i);
  });

  test("the act detail explains that act only", async ({ page }) => {
    await page.goto("/s/sample-leipzig-indie");
    await page.locator("article").nth(1).getByRole("link").first().click();
    const block = page.getByTestId("explanation");
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
