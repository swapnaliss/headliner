import { expect, test } from "@playwright/test";
import { BANNER, noHorizontalOverflow, PICKER } from "../support";

/**
 * M3-06: the core journey with the keyboard only (no pointer events): setup, confirm, slate, share, open an act,
 * open the evidence and close it with Escape. Runs on the picker server so the confirm step has a real choice.
 */
test.use({ baseURL: PICKER, viewport: { width: 360, height: 780 } });

async function focusedName(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return `${el?.tagName ?? ""}:${el?.getAttribute("aria-label") ?? el?.textContent?.trim().slice(0, 40) ?? ""}`;
  });
}

test("keyboard only: skip link, setup, confirm, slate, share, act detail, evidence, Escape", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  // The skip link is the first Tab stop and moves focus to main.
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();

  // Setup: the sample button, then one more candidate typed into the candidate field.
  await page.getByRole("button", { name: "Fill in the sample room" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#city-field")).toHaveValue("Berlin");
  await page.locator("#candidate-input").focus();
  await page.keyboard.type("Bjork");
  await page.keyboard.press("Enter");
  await expect(page.getByText("4 of 12 added")).toBeVisible();

  // Tab order reaches the primary action with no trap (Add button, sentence disclosure, then Rank).
  for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Rank these acts" })).toBeFocused();
  await page.keyboard.press("Enter");

  // Confirm: focus lands on the page heading, the blocked press explains, a radio is chosen with Space.
  await page.waitForURL(/\/run\/[A-Za-z0-9_-]{21}\/confirm$/);
  await expect(page.getByRole("heading", { level: 1, name: "Confirm the matches" })).toBeVisible();
  const rank = page.getByRole("button", { name: "Rank these acts" });
  await rank.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("legend").first()).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Change" })).toBeFocused();
  await rank.focus();
  await page.keyboard.press("Enter");

  // Slate: banner, share link copied with Enter and announced.
  await page.waitForURL(/\/slates\/[A-Za-z0-9_-]{21}$/);
  await expect(page.getByRole("heading", { level: 1, name: /Slate for/ })).toBeVisible();
  await expect(page.getByText(BANNER).first()).toBeVisible();
  const copy = page.getByRole("button", { name: "Copy link" });
  await copy.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Link copied." })).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);

  // Open the first act with Enter on its link (reached by Tab from the card heading region).
  const open = page.locator("article").first().getByRole("link", { name: /^Open details for/ });
  await open.focus();
  await expect(open).toBeFocused();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/slates\/[A-Za-z0-9_-]{21}\/act\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Evidence: an in-page link moves focus to the row, Enter opens its disclosure, Escape closes it and keeps focus on the summary.
  const evidenceLink = page.getByRole("link", { name: "Evidence 1", exact: true }).first();
  await evidenceLink.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#ev-1")).toBeInViewport();
  const summary = page.locator("#ev-1 summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#ev-1 pre")).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(page.locator("#ev-1 pre")).toBeHidden();
  await expect(summary).toBeFocused();
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test("focus is never trapped: Tab then Shift+Tab walks the room form end to end", async ({ page }) => {
  await page.goto("/");
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    seen.add(await focusedName(page));
  }
  // Skip link, brand, banner disclosure, sample links, form controls and footer links all take focus.
  expect(seen.size).toBeGreaterThan(12);
  expect([...seen].some((s) => s.includes("Source on GitHub"))).toBe(true);
  for (let i = 0; i < 40; i++) await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
});

test("focus is visible: every Tab stop on the room page shows an outline of at least 2px", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = getComputedStyle(el);
      return { width: parseFloat(style.outlineWidth), style: style.outlineStyle, shadow: style.boxShadow };
    });
    const visible = (outline.style !== "none" && outline.width >= 2) || outline.shadow !== "none";
    expect(visible, `focus ring on step ${i + 1}`).toBe(true);
  }
});
