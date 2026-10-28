import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { actPath, CANDIDATES, createSlate, CROWD, fillSample, PICKER, type CreatedSlate } from "../support";

export interface SceneContext {
  page: Page;
  request: APIRequestContext;
}

export interface Scene {
  /** Unique, used in the test title and as the screenshot name. */
  name: string;
  /** Screen the scene belongs to (state matrix: room, confirm, slate, act, shared, not-found). */
  screen: "room" | "confirm" | "slate" | "act" | "shared" | "not-found";
  /** Which state of the matrix this is. */
  state: "default" | "loading" | "empty" | "error" | "partial" | "success";
  /** Absolute origin when the scene needs the picker server. */
  origin?: string;
  open: (ctx: SceneContext) => Promise<void>;
  /** Screenshots at the four widths are taken for these (M3-06 AC). */
  screenshots?: boolean;
}

let cached: Promise<CreatedSlate> | undefined;
/** One recorded slate shared by the scenes of a worker; the server keeps it in memory. */
export function slate(request: APIRequestContext): Promise<CreatedSlate> {
  cached ??= createSlate(request);
  return cached;
}

const hang = async (page: Page, pattern: string): Promise<void> => {
  await page.route(pattern, () => new Promise<void>(() => undefined));
};

async function fillAndRank(page: Page): Promise<void> {
  await fillSample(page);
  await page.getByRole("button", { name: "Rank these acts" }).click();
}

/** The room is filled with an extra name the default fixtures do not hold, which leads to the confirm screen. */
async function openConfirm(page: Page, extra: string): Promise<void> {
  await fillSample(page);
  const field = page.locator("#candidate-input");
  await field.fill(extra);
  await field.press("Enter");
  await page.locator("#rank-button").click();
  await page.waitForURL(/\/run\/[A-Za-z0-9_-]{21}\/confirm$/);
  await expect(page.getByRole("heading", { level: 1, name: "Confirm the matches" })).toBeVisible();
}

export const BERLIN_SENTENCE =
  "We are a 350-cap room in Berlin. Our crowd follows Apparat, Moderat, Modeselektor, Hundreds, Brandt Brauer Frick and Boys Noize. We are thinking of booking Khruangbin, Radiohead and Reality Club, and we also want to compare London and Tromso.";

async function openIntake(page: Page, sentence: string): Promise<void> {
  await page.goto("/");
  await page.getByText("Describe it in one sentence").click();
  await page.getByLabel("Describe your room").fill(sentence);
}

export const SCENES: Scene[] = [
  {
    name: "intake-open",
    screen: "room",
    state: "empty",
    open: async ({ page }) => {
      await page.goto("/");
      await page.getByText("Describe it in one sentence").click();
      await expect(page.getByLabel("Describe your room")).toBeVisible();
    },
  },
  {
    name: "intake-reading",
    screen: "room",
    state: "loading",
    open: async ({ page }) => {
      await hang(page, "**/api/intake");
      await openIntake(page, BERLIN_SENTENCE);
      await page.getByRole("button", { name: "Read my description" }).click();
      await expect(page.getByRole("button", { name: "Reading…" })).toBeVisible();
    },
  },
  {
    name: "intake-success",
    screen: "room",
    state: "success",
    open: async ({ page }) => {
      await openIntake(page, BERLIN_SENTENCE);
      await page.getByRole("button", { name: "Read my description" }).click();
      await expect(page.getByTestId("intake-note")).toContainText("We filled in the form");
    },
  },
  {
    name: "intake-partial",
    screen: "room",
    state: "partial",
    open: async ({ page }) => {
      await openIntake(page, "200-cap venue in Leipzig, our regulars love Khruangbin and Bonobo");
      await page.getByRole("button", { name: "Read my description" }).click();
      await expect(page.getByTestId("intake-note")).toContainText("We found a city");
    },
  },
  {
    name: "intake-clarification",
    screen: "room",
    state: "partial",
    open: async ({ page }) => {
      await openIntake(page, "We run a small venue and want to book some bands.");
      await page.getByRole("button", { name: "Read my description" }).click();
      await expect(page.getByLabel("Your answer")).toBeFocused();
    },
  },
  {
    name: "intake-failed",
    screen: "room",
    state: "error",
    open: async ({ page }) => {
      await openIntake(page, "A sentence that was never recorded.");
      await page.getByRole("button", { name: "Read my description" }).click();
      await expect(page.getByRole("heading", { name: "Could not read the description" })).toBeVisible();
    },
  },
  // Room setup
  { name: "room-empty", screen: "room", state: "empty", screenshots: true, open: async ({ page }) => void (await page.goto("/")) },
  { name: "room-sample-filled", screen: "room", state: "default", open: async ({ page }) => fillSample(page) },
  {
    name: "room-validation-error",
    screen: "room",
    state: "error",
    open: async ({ page }) => {
      await page.goto("/");
      // The primary action is aria-disabled until the form is complete; a keyboard press explains why.
      await page.locator("#rank-button").focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".error-summary")).toBeFocused();
    },
  },
  {
    name: "room-loading",
    screen: "room",
    state: "loading",
    open: async ({ page }) => {
      await hang(page, "**/api/slates");
      await fillAndRank(page);
      await expect(page.getByRole("heading", { name: "Ranking in progress" })).toBeVisible();
    },
  },
  {
    name: "room-error-upstream",
    screen: "room",
    state: "error",
    open: async ({ page }) => {
      await page.route("**/api/slates", (route) =>
        route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "upstream_unavailable", message: "raw upstream text" } }) }),
      );
      await fillAndRank(page);
      await expect(page.getByRole("heading", { name: "Could not rank these acts" })).toBeVisible();
    },
  },
  {
    name: "room-error-demo-limit",
    screen: "room",
    state: "error",
    open: async ({ page }) => {
      await page.route("**/api/slates", (route) =>
        route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: { code: "demo_limit_reached", message: "limit" } }) }),
      );
      await fillAndRank(page);
      await expect(page.getByRole("heading", { name: "Daily demo limit reached" })).toBeVisible();
    },
  },

  // Match confirmation
  {
    name: "confirm-not-in-recordings",
    screen: "confirm",
    state: "partial",
    open: async ({ page }) => openConfirm(page, "Bjork"),
  },
  {
    name: "confirm-picker",
    screen: "confirm",
    state: "default",
    origin: PICKER,
    open: async ({ page }) => {
      await openConfirm(page, "Bjork");
      await expect(page.getByRole("group", { name: /Which Bjork\?/ })).toBeVisible();
    },
  },
  {
    name: "confirm-gone",
    screen: "confirm",
    state: "empty",
    open: async ({ page }) => {
      await page.goto("/run/not-a-run-id/confirm");
      await expect(page.getByRole("heading", { name: "This run is no longer available." })).toBeVisible();
    },
  },

  // Slate
  {
    name: "slate-ranked",
    screen: "slate",
    state: "default",
    screenshots: true,
    open: async ({ page, request }) => {
      const s = await slate(request);
      await page.goto(`/slates/${s.id}`);
      await expect(page.getByRole("heading", { level: 1, name: /Slate for/ })).toBeVisible();
    },
  },
  {
    name: "slate-with-notes",
    screen: "slate",
    state: "partial",
    open: async ({ page }) => {
      await openConfirm(page, "Bjork");
      await page.getByRole("button", { name: "Remove act" }).click();
      await page.getByRole("button", { name: "Rank these acts" }).click();
      await page.waitForURL(/\/slates\/[A-Za-z0-9_-]{21}$/);
      await expect(page.getByTestId("slate-notes")).toBeVisible();
    },
  },
  {
    name: "slate-404",
    screen: "not-found",
    state: "empty",
    open: async ({ page }) => void (await page.goto("/slates/not-a-real-slate-id")),
  },

  // Act detail
  {
    name: "act-ranked",
    screen: "act",
    state: "default",
    screenshots: true,
    open: async ({ page, request }) => {
      const s = await slate(request);
      await page.goto(actPath(s, "Reality Club"));
      await expect(page.getByRole("heading", { level: 1, name: "Reality Club" })).toBeVisible();
      await page.locator("#cities").scrollIntoViewIfNeeded();
      await expect(page.getByText(/City strength loaded/)).toBeVisible();
    },
  },
  {
    name: "act-cities-loading",
    screen: "act",
    state: "loading",
    open: async ({ page, request }) => {
      const s = await slate(request);
      await hang(page, "**/cities");
      await page.goto(actPath(s, "Reality Club"));
      await page.locator("#cities").scrollIntoViewIfNeeded();
      await expect(page.locator("#cities [aria-busy='true']").first()).toBeVisible();
    },
  },
  {
    name: "act-cities-error",
    screen: "act",
    state: "error",
    open: async ({ page, request }) => {
      const s = await slate(request);
      await page.route("**/cities", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "upstream_unavailable", message: "raw" } }) }));
      await page.goto(actPath(s, "Reality Club"));
      await page.locator("#cities").scrollIntoViewIfNeeded();
      await expect(page.getByText(/could not be loaded|Could not load/i).first()).toBeVisible();
    },
  },
  {
    name: "act-no-data",
    screen: "act",
    state: "empty",
    open: async ({ page, request }) => {
      const s = await slate(request);
      await page.goto(actPath(s, "Hindia"));
      await expect(page.getByText(/^No Qloo data for this act\./)).toBeVisible();
    },
  },
  {
    name: "act-evidence-open",
    screen: "act",
    state: "default",
    open: async ({ page, request }) => {
      const s = await slate(request);
      await page.goto(actPath(s, "Reality Club"));
      await page.getByRole("link", { name: "Evidence 1", exact: true }).first().click();
      await page.locator("#ev-1 summary").click();
      await expect(page.locator("#ev-1 pre")).toBeVisible();
    },
  },
  {
    name: "act-404",
    screen: "not-found",
    state: "empty",
    open: async ({ page, request }) => {
      const s = await slate(request);
      await page.goto(`/slates/${s.id}/act/${encodeURIComponent("no-such-act")}`);
    },
  },

  // Shared slate (read-only)
  {
    name: "shared-slate",
    screen: "shared",
    state: "default",
    open: async ({ page }) => {
      await page.goto("/s/sample-berlin-electronic");
      await expect(page.getByRole("heading", { level: 1, name: /Slate for/ })).toBeVisible();
    },
  },
  {
    name: "shared-act",
    screen: "shared",
    state: "default",
    open: async ({ page }) => {
      await page.goto("/s/sample-berlin-electronic");
      await page.locator("article").first().getByRole("link", { name: /^Open details for/ }).click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
  },
  {
    name: "shared-404",
    screen: "not-found",
    state: "empty",
    open: async ({ page }) => void (await page.goto("/s/sample-no-such-room")),
  },
  { name: "global-404", screen: "not-found", state: "empty", open: async ({ page }) => void (await page.goto("/no-such-page")) },
];

export { CANDIDATES, CROWD };
