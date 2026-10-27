import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";

const ROOM = {
  city: "Berlin",
  crowdActs: ["Apparat", "Moderat", "Modeselektor", "Hundreds", "Brandt Brauer Frick", "Boys Noize"],
  candidateActs: ["Khruangbin", "Radiohead", "Reality Club", "Hindia"],
};

/** Creates the recorded room and returns the act page path of Reality Club (it has a thin city and an empty city). */
async function actPath(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/slates", { data: ROOM });
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { id: string; slate: { results: { act: { name: string; qlooEntityId: string } }[] } };
  const act = body.slate.results.find((r) => r.act.name === "Reality Club");
  return `/slates/${body.id}/act/${act?.act.qlooEntityId}`;
}

test("opening an act loads city strength lazily: ranked list, Thin data flag and the no-data state", async ({ page, request }) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/cities")) calls.push(r.postData() ?? "");
  });
  await page.goto(await actPath(request));
  await expect(page.getByRole("heading", { level: 1, name: "Reality Club" })).toBeVisible();
  await page.locator("#cities").scrollIntoViewIfNeeded();
  await expect(page.getByText(/City strength loaded for 5 cities\. 2 have thin data\./)).toBeVisible();
  expect(calls).toHaveLength(5);

  const ranked = page.getByRole("list", { name: "Cities compared" }).getByRole("listitem");
  await expect(ranked.first()).toContainText("Jakarta");
  await expect(ranked.first()).toContainText("Mean affinity rank 0.780");
  const thin = page.getByRole("list", { name: "Cities with thin data" });
  await expect(thin).toContainText("Thin data");
  await expect(thin).toContainText("Berlin");
  await expect(thin).toContainText("Leipzig");
  await expect(page.getByText("Qloo returned no usable audience data there.")).toBeVisible();
  await expect(page.getByText(/aggregate affinity, not a ticket forecast/).first()).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe, ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });
    test(`no serious or critical violations on the act page with city strength loaded`, async ({ page, request }) => {
      await page.goto(await actPath(request));
      await page.locator("#cities").scrollIntoViewIfNeeded();
      await expect(page.getByText(/City strength loaded/)).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  });
}

test.describe("375px", () => {
  test.use({ viewport: { width: 375, height: 780 } });
  test("no horizontal overflow with every state on screen", async ({ page, request }) => {
    await page.goto(await actPath(request));
    await page.locator("#cities").scrollIntoViewIfNeeded();
    await expect(page.getByText(/City strength loaded/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});

test("an unknown act is a 404 and a bad slate id is a 404", async ({ page, request }) => {
  const path = await actPath(request);
  const slate = path.split("/")[2];
  expect((await page.goto(`/slates/${slate}/act/00000000-0000-0000-0000-000000000000`))?.status()).toBe(404);
  expect((await page.goto("/slates/short/act/x"))?.status()).toBe(404);
});
