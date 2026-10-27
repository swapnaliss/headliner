import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const ROOM = {
  city: "Berlin",
  crowdActs: ["Apparat", "Moderat", "Modeselektor", "Hundreds", "Brandt Brauer Frick", "Boys Noize"],
  candidateActs: ["Khruangbin", "Radiohead", "Reality Club", "Hindia"],
};

async function createSlate(request: APIRequestContext): Promise<{ id: string; results: { act: { qlooEntityId: string; name: string }; rank: number | null }[] }> {
  const res = await request.post("/api/slates", { data: ROOM });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { id: string; slate: { results: { act: { qlooEntityId: string; name: string }; rank: number | null }[] } };
  return { id: body.id, results: body.slate.results };
}

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

test.describe("act detail", () => {
  test("opens from a slate card, shows tastes and evidence, and the evidence disclosure works by keyboard", async ({ page, request }) => {
    const { id } = await createSlate(request);
    await page.goto(`/slates/${id}`);
    const card = page.locator("article").first();
    await card.getByRole("link", { name: /^Open details for/ }).click();
    await page.waitForURL(new RegExp(`/slates/${id}/act/`));
    await expect(page.getByRole("heading", { level: 1, name: "Reality Club" })).toBeVisible();
    await expect(page.getByText("Rank 1 of 3")).toBeVisible();
    await expect(page.getByText("aggregate affinity, not a ticket forecast").first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /^Shared tastes \(/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /^Evidence trail \(8 calls\)$/ })).toBeVisible();

    // "See evidence" link moves to the row, which is outlined and says why.
    await page.getByRole("link", { name: "Evidence 1", exact: true }).first().click();
    await expect(page.locator("#ev-1")).toBeInViewport();
    await expect(page.locator("#ev-1").getByText("Linked from above")).toBeVisible();

    // The parameters disclosure is a native details element: Enter/Space on the summary opens it.
    const summary = page.locator("#ev-1 summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    const pre = page.locator("#ev-1 pre");
    await expect(pre).toBeVisible();
    const text = (await pre.textContent()) ?? "";
    expect(text).toMatch(/^GET \/search\nquery=/);
    expect(text).toContain("responseDigest=");
    expect(text.toLowerCase()).not.toContain("api-key");
    await expect(page.getByRole("button", { name: "Copy request 1" })).toBeVisible();

    // Show all / fewer keeps focus on the button.
    const showAll = page.getByRole("button", { name: /^Show all \d+$/ });
    await showAll.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Show fewer" })).toBeFocused();
  });

  test("the act with no data shows the honest empty state and no number", async ({ page, request }) => {
    const { id, results } = await createSlate(request);
    const hindia = results.find((r) => r.act.name === "Hindia");
    expect(hindia).toBeTruthy();
    await page.goto(`/slates/${id}/act/${encodeURIComponent(hindia?.act.qlooEntityId ?? "")}`);
    await expect(page.getByText(/^No Qloo data for this act\./)).toBeVisible();
    await expect(page.getByText("Fit unavailable")).toBeVisible();
    await expect(page.getByText("Not ranked")).toBeVisible();
    await expect(page.getByTestId("fit-value")).toHaveCount(0);
  });

  test("an unknown act or slate is a 404 with a way back", async ({ page, request }) => {
    const { id } = await createSlate(request);
    const res = await page.goto(`/slates/${id}/act/${encodeURIComponent("<img src=x onerror=alert(1)>")}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "This act is not on this slate." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the slate" })).toHaveAttribute("href", `/slates/${id}`);
    await expect(page.locator("img")).toHaveCount(0);
  });

  test.describe("360px", () => {
    test.use({ viewport: { width: 360, height: 740 } });
    test("no horizontal overflow", async ({ page, request }) => {
      const { id, results } = await createSlate(request);
      const first = results.find((r) => r.rank === 1);
      await page.goto(`/slates/${id}/act/${encodeURIComponent(first?.act.qlooEntityId ?? "")}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await noHorizontalOverflow(page)).toBe(true);
    });
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`axe finds no serious or critical issue (${scheme})`, async ({ page, request }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const { id, results } = await createSlate(request);
      for (const result of [results.find((r) => r.rank === 1), results.find((r) => r.rank === null)]) {
        await page.goto(`/slates/${id}/act/${encodeURIComponent(result?.act.qlooEntityId ?? "")}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.locator("summary", { hasText: "Show parameters and digest" }).first().click().catch(() => undefined);
        const axe = await new AxeBuilder({ page }).analyze();
        const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
      }
    });
  }
});
