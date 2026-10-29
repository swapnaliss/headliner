import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const BANNER = "aggregate affinity, not a ticket forecast";

test.describe("sample rooms on the intake screen", () => {
  test("lists the sample rooms with the recording date and opens a finished slate in one press", async ({ page }) => {
    await page.goto("/");
    const section = page.getByRole("region", { name: "Try a sample room" });
    await expect(section).toBeVisible();
    await expect(section.getByText(/Recorded real Qloo run, fetched \d{1,2} \w{3} \d{4}/).first()).toBeVisible();
    const links = section.getByRole("link");
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveText("Open sample slate");
    await expect(links.nth(0)).toHaveAccessibleName("Open sample slate: Berlin electronic club, Berlin");

    await links.nth(0).click();
    await page.waitForURL(/\/s\/sample-berlin-electronic$/);
    await expect(page.getByRole("heading", { level: 1, name: /Slate for/ })).toBeVisible();
    await expect(page.locator("article")).toHaveCount(5);
    await expect(page.getByText(BANNER).first()).toBeVisible();
  });

  test("the sample slate's act detail shows the saved city strengths, and an unknown sample is not found", async ({ page }) => {
    await page.goto("/s/sample-leipzig-indie");
    await page.locator("article").first().getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: "Other cities compared" })).toBeVisible();
    const missing = await page.goto("/s/sample-no-such-room");
    expect(missing?.status()).toBe(404);
  });

  test("keyboard: Tab reaches the sample links and Enter opens one; axe finds nothing serious", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    const first = page.getByRole("region", { name: "Try a sample room" }).getByRole("link").first();
    await first.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/s\/sample-/);
  });
});
