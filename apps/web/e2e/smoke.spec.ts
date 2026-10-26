import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const BANNER = "aggregate affinity, not a ticket forecast";
const CROWD = ["Apparat", "Moderat", "Modeselektor", "Hundreds", "Brandt Brauer Frick", "Boys Noize"];
const CANDIDATES = ["Khruangbin", "Radiohead", "Reality Club", "Hindia"];

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

/** Types the recorded Berlin room using the keyboard only, then presses Enter on the primary action. */
async function submitByKeyboard(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#city-field").focus();
  await page.keyboard.type("Berlin");
  await page.keyboard.press("Tab"); // crowd add field
  for (const name of CROWD) {
    await page.keyboard.type(name);
    await page.keyboard.press("Enter");
  }
  // Tab order after the crowd input: Add button, then the candidate input.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  for (const name of CANDIDATES) {
    await page.keyboard.type(name);
    await page.keyboard.press("Enter");
  }
  await expect(page.getByText("6 of 6 added")).toBeVisible();
  await expect(page.getByText("4 of 12 added")).toBeVisible();
  // Add button, sentence disclosure, then the primary action.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Rank these acts" })).toBeFocused();
  await page.keyboard.press("Enter");
}

test.describe("360px keyboard-only journey", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("submits the recorded room by keyboard and reads the slate with no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    expect(await noHorizontalOverflow(page)).toBe(true);
    await submitByKeyboard(page);
    await page.waitForURL(/\/slates\/[A-Za-z0-9_-]{21}$/);
    await expect(page.getByRole("heading", { level: 1, name: /Slate for/ })).toBeVisible();
    const cards = page.locator("article");
    await expect(cards).toHaveCount(4);
    await expect(cards.first().getByRole("heading", { name: "Reality Club" })).toBeVisible();
    await expect(cards.first().getByText("Qloo popularity rank")).toBeVisible();
    await expect(cards.first().getByText(/^Fit$/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Not ranked (1)" })).toBeVisible();
    await expect(page.getByText("No data for Hindia")).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test("an incomplete form focuses the error summary and keeps nothing lost", async ({ page }) => {
    await page.goto("/");
    await page.locator("#rank-button").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".error-summary")).toBeFocused();
    await expect(page.locator(".error-summary")).toContainText("Fix 3 things to continue");
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});

test.describe("banner and routes", () => {
  test("the Banner string is in the HTML of the room page, a slate page and a not-found page", async ({ page, request }) => {
    const home = await request.get("/");
    expect(home.status()).toBe(200);
    expect(await home.text()).toContain(BANNER);

    const created = await request.post("/api/slates", {
      data: { city: "Berlin", crowdActs: CROWD, candidateActs: CANDIDATES.slice(0, 3) },
    });
    const { id } = (await created.json()) as { id: string };
    const slate = await request.get(`/slates/${id}`);
    expect(slate.status()).toBe(200);
    const html = await slate.text();
    expect(html).toContain(BANNER);
    expect(html).not.toMatch(/dangerouslySetInnerHTML/);
    expect(html).toContain("noindex");

    const missing = await request.get("/slates/not-a-real-slate-id");
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain(BANNER);

    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    await page.goto("/");
    await expect(page.getByText("Demo mode: recorded Qloo responses")).toBeVisible();
  });

  test("a server failure shows the generic error state with retry and keeps the entries", async ({ page }) => {
    await page.route("**/api/slates", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "upstream_unavailable", message: "internal detail hackathon.api.qloo.com" } }) }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Fill in the sample room" }).click();
    await page.getByRole("button", { name: "Rank these acts" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "Could not rank these acts" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Could not reach Qloo. Your entries are kept. Try again.");
    await expect(alert).not.toContainText("hackathon");
    await expect(page.locator("#city-field")).toHaveValue("Berlin");
  });
});

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe, ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test("zero serious or critical violations on / and on a slate page", async ({ page, request }) => {
      await page.goto("/");
      const home = await new AxeBuilder({ page }).analyze();
      const created = await request.post("/api/slates", { data: { city: "Berlin", crowdActs: CROWD, candidateActs: CANDIDATES } });
      const { id } = (await created.json()) as { id: string };
      await page.goto(`/slates/${id}`);
      // The Evidence trail moved to the act detail page (M2-02); its axe run is in act-detail.spec.ts.
      const slate = await new AxeBuilder({ page }).analyze();
      const blocking = [...home.violations, ...slate.violations].filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  });
}
