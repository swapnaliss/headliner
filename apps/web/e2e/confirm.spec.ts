import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const BANNER = "aggregate affinity, not a ticket forecast";
const CROWD = ["Apparat", "Moderat", "Modeselektor", "Hundreds", "Brandt Brauer Frick", "Boys Noize"];
const PICKER = `http://127.0.0.1:${Number(process.env["E2E_PORT"] ?? 3100) + 1}`;

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

/** Fills the sample room, adds one more candidate by keyboard and presses Enter on the primary action. */
async function submitWith(page: Page, extra: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Fill in the sample room" }).click();
  const field = page.locator("#candidate-input");
  await field.focus();
  await page.keyboard.type(extra);
  await page.keyboard.press("Enter");
  await page.locator("#rank-button").focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/run\/[A-Za-z0-9_-]{21}\/confirm$/);
}

test.describe("picker server (ambiguous name)", () => {
  test.use({ baseURL: PICKER });

  test("keyboard only: choose the right match, then rank", async ({ page }) => {
    await submitWith(page, "Bjork");
    await expect(page.getByRole("heading", { level: 1, name: "Confirm the matches" })).toBeVisible();
    await expect(page.getByTestId("status-line")).toHaveText("1 name needs your choice, 9 confirmed.");
    const rank = page.getByRole("button", { name: "Rank these acts" });
    await expect(rank).toHaveAttribute("aria-disabled", "true");

    // Blocked press: focus moves to the unresolved group and nothing is posted.
    await rank.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("legend").first()).toBeFocused();
    await expect(page).toHaveURL(/\/confirm$/);

    // Tab into the group once, arrow to pick (nothing is preselected), then rank.
    await page.keyboard.press("Tab");
    const radios = page.getByRole("group", { name: /Which Bjork\?/ }).getByRole("radio");
    await expect(radios.first()).toBeFocused();
    expect(await radios.evaluateAll((els) => els.some((e) => (e as HTMLInputElement).checked))).toBe(false);
    await page.keyboard.press("Space");
    // The row moves to Confirmed and focus follows to its Change button.
    await expect(page.getByRole("button", { name: "Change" })).toBeFocused();
    await expect(page.getByText("Match chosen by you")).toBeVisible();
    await expect(rank).not.toHaveAttribute("aria-disabled", "true");
    await rank.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/slates\/[A-Za-z0-9_-]{21}$/);
    await expect(page.getByRole("heading", { level: 1, name: /Slate for/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Björk", exact: true })).toBeVisible();
    await expect(page.getByText(BANNER).first()).toBeVisible();
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`axe on the picker, ${scheme}, with no horizontal overflow at 360px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 360, height: 800 });
      await submitWith(page, "Bjork");
      expect(await noHorizontalOverflow(page)).toBe(true);
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }

  test("a stale or unknown run shows the gone state", async ({ page, request }) => {
    const missing = await request.get("/run/AAAAAAAAAAAAAAAAAAAAA/confirm");
    expect(missing.status()).toBe(200);
    expect(await missing.text()).toContain("This run is no longer available.");
    await page.goto("/run/not-a-run-id/confirm");
    await expect(page.getByRole("heading", { name: "This run is no longer available." })).toBeVisible();
  });
});

test.describe("default fixtures server (name not in the recordings)", () => {
  test("explains that the demo has no recording and lets the user leave the act out", async ({ page, request }) => {
    const created = await request.post("/api/slates", { data: { city: "Berlin", crowdActs: CROWD, candidateActs: ["Khruangbin", "Radiohead", "Reality Club", "Bjork"] } });
    const body = (await created.json()) as { status: string; runId: string; matches: { state: string }[] };
    expect(body.status).toBe("awaiting_confirmation");
    expect(body.matches.filter((m) => m.state !== "exact")).toHaveLength(1);

    await page.goto(`/run/${body.runId}/confirm`);
    await expect(page.getByText("Bjork is not in the recorded responses")).toBeVisible();
    const rank = page.getByRole("button", { name: "Rank these acts" });
    await expect(rank).toHaveAttribute("aria-disabled", "true");
    await page.getByRole("button", { name: "Remove act" }).click();
    await expect(page.getByTestId("status-line")).toHaveText("All 9 names confirmed, 1 left out.");
    await rank.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/slates\/[A-Za-z0-9_-]{21}$/);
    await expect(page.getByTestId("slate-notes")).toContainText("Skipped by you");
  });

  test("the confirm page carries the Banner in its HTML", async ({ request }) => {
    const created = await request.post("/api/slates", { data: { city: "Berlin", crowdActs: CROWD, candidateActs: ["Khruangbin", "Radiohead", "Reality Club", "Bjork"] } });
    const { runId } = (await created.json()) as { runId: string };
    const html = await (await request.get(`/run/${runId}/confirm`)).text();
    expect(html).toContain(BANNER);
    expect(html).toContain("noindex");
  });
});
