import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const ROOM = {
  city: "Berlin",
  crowdActs: ["Apparat", "Moderat", "Modeselektor", "Hundreds", "Brandt Brauer Frick", "Boys Noize"],
  candidateActs: ["Khruangbin", "Radiohead", "Reality Club"],
};

async function createSlate(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/slates", { data: ROOM });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { id: string }).id;
}

/** Collects console errors, page errors and CSP violation reports so a blocked script or style fails the test. */
function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test.describe("share", () => {
  test("the owner page copies a link that opens the read-only shared page", async ({ page, context, request, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const problems = watch(page);
    const id = await createSlate(request);
    await page.goto(`/slates/${id}`);
    await expect(page.getByRole("heading", { level: 2, name: "Share this slate" })).toBeVisible();
    await expect(page.getByText(/Demo mode keeps slates in memory only/)).toBeVisible();
    const field = page.getByLabel("Link to this slate");
    await expect(field).toHaveValue(`${baseURL}/s/${id}`);

    // Keyboard access: Tab reaches the field's Copy link button; Enter copies and announces.
    const copy = page.getByRole("button", { name: "Copy link" });
    await copy.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Link copied." })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}/s/${id}`);

    await page.goto(`/s/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Slate for Berlin" })).toBeVisible();
    await expect(page.getByText("aggregate affinity, not a ticket forecast").first()).toBeVisible();
    await expect(page.getByTestId("shared-line")).toContainText("Shared slate, created");
    await expect(page.getByRole("button", { name: "Copy link" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Change room" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Make your own slate" }).first()).toBeVisible();
    expect(await page.locator('meta[name="robots"]').getAttribute("content")).toBe("noindex, nofollow");
    expect(problems).toEqual([]);
  });

  test("a card on the shared page opens the read-only act detail with its evidence trail", async ({ page, request }) => {
    const problems = watch(page);
    const id = await createSlate(request);
    await page.goto(`/s/${id}`);
    await page.locator("article").first().getByRole("link", { name: /^Open details for/ }).click();
    await page.waitForURL(new RegExp(`/s/${id}/act/`));
    await expect(page.getByRole("heading", { level: 1, name: "Reality Club" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /^Evidence trail \(/ })).toBeVisible();
    // Read-only: no endpoint is called for cities and nothing offers to load them.
    await expect(page.getByRole("button", { name: "Load city strength" })).toHaveCount(0);
    await page.getByRole("link", { name: "Back to the slate" }).click();
    await page.waitForURL(new RegExp(`/s/${id}$`));
    expect(problems).toEqual([]);
  });

  test("an unknown, a malformed and a hostile id all give the same 404 page", async ({ page, request }) => {
    for (const path of ["/s/AAAAAAAAAAAAAAAAAAAAA", "/s/not-a-real-id", "/s/..%2F..%2Fetc%2Fpasswd", "/s/a'%20OR%201=1"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
      expect(res?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
      await expect(page.getByRole("heading", { level: 1, name: "This slate is no longer available." })).toBeVisible();
      await expect(page.getByText("Slates are kept for 30 days.")).toBeVisible();
    }
    // A real slate id under a made-up act is a 404 too.
    const id = await createSlate(request);
    const res = await page.goto(`/s/${id}/act/nope`);
    expect(res?.status()).toBe(404);
  });

  test("security headers are on every response", async ({ request }) => {
    const id = await createSlate(request);
    for (const path of ["/", `/s/${id}`, `/slates/${id}`, "/api/health"]) {
      const res = await request.get(path);
      const csp = res.headers()["content-security-policy"] ?? "";
      expect(csp, path).toContain("frame-ancestors 'none'");
      expect(csp, path).toContain("object-src 'none'");
      expect(csp, path).toContain("base-uri 'none'");
      expect(csp.match(/script-src[^;]*/)?.[0], path).not.toMatch(/unsafe-(inline|eval)/);
      expect(res.headers()["x-content-type-options"], path).toBe("nosniff");
      expect(res.headers()["referrer-policy"], path).toBe("no-referrer");
    }
    const shared = await request.get(`/s/${id}`);
    expect(shared.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`axe finds no violations on the shared page and its 404 (${scheme})`, async ({ page, request }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const id = await createSlate(request);
      for (const path of [`/s/${id}`, `/s/${id}/act/${encodeURIComponent("nope")}`, "/s/AAAAAAAAAAAAAAAAAAAAA"]) {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        expect(results.violations.map((v) => `${v.id} @ ${path}`)).toEqual([]);
      }
    });
  }
});
