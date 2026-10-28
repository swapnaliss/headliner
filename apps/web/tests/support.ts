import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** The banner every screen carries (CLAUDE.md, N-03). */
export const BANNER = "aggregate affinity, not a ticket forecast";

export const CROWD = ["Apparat", "Moderat", "Modeselektor", "Hundreds", "Brandt Brauer Frick", "Boys Noize"];
export const CANDIDATES = ["Khruangbin", "Radiohead", "Reality Club", "Hindia"];
export const ROOM = { city: "Berlin", crowdActs: CROWD, candidateActs: CANDIDATES };

/** The second server (PORT + 1) answers the ambiguous name "Bjork" with a recorded multi-hit search. */
export const PICKER = `http://127.0.0.1:${Number(process.env["E2E_PORT"] ?? 3100) + 1}`;

export const WIDTHS = [360, 1280] as const;
export const SCHEMES = ["light", "dark"] as const;
export type Scheme = (typeof SCHEMES)[number];

export interface CreatedSlate {
  id: string;
  results: { act: { qlooEntityId: string; name: string }; rank: number | null }[];
}

export async function createSlate(request: APIRequestContext): Promise<CreatedSlate> {
  const res = await request.post("/api/slates", { data: ROOM });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { id: string; slate: { results: CreatedSlate["results"] } };
  return { id: body.id, results: body.slate.results };
}

export function actPath(slate: CreatedSlate, name: string, base = "/slates"): string {
  const hit = slate.results.find((r) => r.act.name === name);
  expect(hit, `act ${name} on the slate`).toBeTruthy();
  return `${base}/${slate.id}/act/${encodeURIComponent(hit?.act.qlooEntityId ?? "")}`;
}

export async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

export interface ScanResult {
  blocking: string[];
  moderateOrMinor: string[];
}

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** axe over the page as it stands: WCAG 2.0 to 2.2 A and AA rules plus best practices. */
export async function scan(page: Page): Promise<ScanResult> {
  const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS, "best-practice"]).analyze();
  const describe = (v: (typeof results.violations)[number]): string => `${v.impact ?? "?"} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`;
  return {
    blocking: results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map(describe),
    moderateOrMinor: results.violations.filter((v) => v.impact !== "serious" && v.impact !== "critical").map(describe),
  };
}

/** Structure every screen must have (A-02 to A-04, N-03). */
export async function expectPageBasics(page: Page): Promise<void> {
  await expect(page.getByText(BANNER).first()).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("header")).toHaveCount(1);
  await expect(page.locator("footer")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
  expect(await page.title()).toMatch(/Headliner/);
  expect(await page.locator("html").getAttribute("lang")).toBe("en");
}

/** Fills the recorded sample room on `/` and waits for the form to hold it. */
export async function fillSample(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Fill in the sample room" }).click();
  await expect(page.locator("#city-field")).toHaveValue("Berlin");
}
