// M2-GATE: times the typed-room core journey in a real browser and walks storyboard steps 1 to 8 on it.
//
//   node node_modules/tsx/dist/cli.mjs scripts/m2-gate-journey.mts <base url> [runs] [out.json]
//
// Run 1 is the cold run: it types the room, confirms the two ambiguous names on the match screen, reads
// the slate, opens the top act, lets the city strip load lazily, copies the share link and opens it in a
// clean browser context. Runs 2..n repeat the same room (all Qloo answers cached: warm) and only time the
// journey. The stopwatch starts at navigation to "/" and stops when the slate heading is visible; it
// includes the scripted typing (milliseconds) and the confirm screen. Prints a JSON report: no key, no IP.
//
// Spends live Qloo calls on a production host the first time a room is new (about 16 searches/compares plus
// the lazy city loads). Do not run it in a loop.
import { writeFileSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) throw new Error("usage: m2-gate-journey.mts <base url> [runs] [out.json]");
const runs = Number(process.argv[3] ?? 3);
const outFile = process.argv[4];

const ROOM = {
  city: "London",
  crowd: ["Radiohead", "Portishead", "Massive Attack", "Bonobo", "Four Tet", "Burial"],
  candidates: ["Khruangbin", "Caribou", "Floating Points", "Bjork", "Wynn Delacroix"],
  // what the user picks on the match screen for each ambiguous typed name
  picks: { Bjork: "Björk", "Wynn Delacroix": "Timothy Michael Wynn" } as Record<string, string>,
};

type Json = Record<string, unknown>;
const secs = (ms: number) => Math.round(ms) / 1000;

async function typeRoom(page: Page): Promise<void> {
  await page.locator("#city-field").fill(ROOM.city);
  for (const name of ROOM.crowd) {
    await page.locator("#crowd-input").fill(name);
    await page.keyboard.press("Enter");
  }
  for (const name of ROOM.candidates) {
    await page.locator("#candidate-input").fill(name);
    await page.keyboard.press("Enter");
  }
}

async function oneRun(browser: Awaited<ReturnType<typeof chromium.launch>>, full: boolean): Promise<Json> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const report: Json = {};
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text().slice(0, 120)}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 120)}`));
  const apiCalls: string[] = [];
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/")) apiCalls.push(`${r.request().method()} ${u.pathname.replace(/[A-Za-z0-9_-]{21}/g, ":id")} ${r.status()}`);
  });

  const t0 = Date.now();
  const home = await page.goto(`${base}/`);
  await page.waitForSelector("#city-field");
  await page.waitForLoadState("networkidle"); // typing before React hydrates would be lost
  if (full) {
    const text = await page.locator("body").innerText();
    report["step1"] = {
      status: home?.status(),
      banner: text.includes("aggregate affinity, not a ticket forecast"),
      demoLimitsNote: ((await page.getByTestId("demo-limits").innerText().catch(() => "ABSENT")) || "ABSENT").replace(/\s+/g, " ").trim(),
      loginOrCaptchaWall: (await page.locator('input[type="password"], iframe[src*="captcha" i], iframe[src*="recaptcha" i], [class*="captcha" i]').count()) > 0,
    };
  }
  await typeRoom(page);
  const tFilled = Date.now();
  if ((await page.locator("#rank-button").getAttribute("aria-disabled")) === "true") {
    throw new Error(`rank button disabled after typing the room: ${(await page.locator("#rank-reason").innerText()).slice(0, 200)}`);
  }
  await page.locator("#rank-button").click();

  await page.waitForURL(/\/(run\/[^/]+\/confirm|slates\/[A-Za-z0-9_-]{21})$/, { timeout: 120_000 });
  const tAfterPost = Date.now();
  let confirmMs: number | undefined;
  if (/\/confirm$/.test(page.url())) {
    await page.getByRole("heading", { level: 1, name: "Confirm the matches" }).waitFor();
    const rank = page.locator("#rank-button");
    if (full) {
      const statusLine = await page.getByTestId("status-line").innerText();
      const groups = await page.locator("fieldset.match-picker legend").allInnerTexts();
      const disabledBefore = (await rank.getAttribute("aria-disabled")) === "true";
      const urlBefore = page.url();
      await rank.click({ force: true }); // blocked press (aria-disabled): must not rank
      await page.waitForTimeout(500);
      report["step2"] = {
        matchScreen: true,
        statusLine,
        ambiguousGroups: groups.map((g) => g.replace(/\s+/g, " ").trim()),
        rankDisabledBeforeChoice: disabledBefore,
        blockedPressStayedOnConfirm: page.url() === urlBefore,
        apiCallsBeforeConfirm: [...apiCalls],
      };
    }
    const tc = Date.now();
    for (const [typed, pick] of Object.entries(ROOM.picks)) {
      const group = page.locator("fieldset.match-picker", { has: page.locator("legend", { hasText: typed }) });
      await group.locator("label.match-option", { hasText: pick }).first().click();
    }
    if (full) (report["step2"] as Json)["rankEnabledAfterChoices"] = (await rank.getAttribute("aria-disabled")) !== "true";
    await rank.click();
    await page.waitForURL(/\/slates\/[A-Za-z0-9_-]{21}$/, { timeout: 120_000 });
    confirmMs = Date.now() - tc;
  }
  await page.getByRole("heading", { level: 1, name: /Slate for/ }).waitFor();
  const tDone = Date.now();
  const slateUrl = page.url();
  report["timing"] = {
    totalSeconds: secs(tDone - t0),
    formFilledSeconds: secs(tFilled - t0),
    createRequestAndNavigationSeconds: secs(tAfterPost - tFilled),
    confirmAndRankSeconds: confirmMs === undefined ? null : secs(confirmMs),
  };
  report["apiCalls"] = apiCalls;

  if (full) {
    const cards = await page.locator("article").evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, " ").trim().slice(0, 260)));
    report["step3"] = {
      cards,
      qlooPopularityRankLabelInCards: cards.filter((c) => c.includes("Qloo popularity rank")).length,
      fitLabelInCards: cards.filter((c) => /\bFit\b/.test(c)).length,
      banner: (await page.locator("body").innerText()).includes("aggregate affinity, not a ticket forecast"),
    };
    const table = page.locator("table").first();
    const rows = await table.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll("th,td")).map((c) => (c as HTMLElement).innerText.replace(/\s+/g, " ").trim())));
    const sentence = await page.locator("#compare-heading + p").innerText();
    report["step4"] = { sentence, columns: await table.locator("thead th").allInnerTexts(), rows };
    report["step7"] = { noDataCards: cards.filter((c) => /no data/i.test(c)), notRankedHeading: await page.getByRole("heading", { name: /Not ranked/ }).allInnerTexts() };

    // Step 5 and 6: open the top act.
    const cityCallsBeforeOpen = apiCalls.filter((c) => c.includes("/cities")).length;
    await page.locator("article").first().getByRole("link", { name: /^Open details for/ }).click();
    await page.waitForURL(/\/act\//);
    const heading = await page.getByRole("heading", { level: 1 }).innerText();
    const tOpen = Date.now();
    const bodyText = await page.locator("body").innerText();
    report["step5"] = {
      act: heading,
      url: page.url().replace(/[A-Za-z0-9_-]{21}/, ":id"),
      sharedTastesHeading: await page.getByRole("heading", { name: /Shared tastes/ }).count(),
      sharedTastesSample: (await page.locator("#tastes tbody tr").evaluateAll((trs) => trs.map((tr) => (tr as HTMLElement).innerText.replace(/\s+/g, " ").trim()))).slice(0, 5),
    };
    const evidenceHeading = (await page.getByRole("heading", { name: /Evidence trail/ }).first().innerText()).trim();
    const evRows = await page.locator("#evidence table tbody tr").evaluateAll((trs) => trs.map((tr) => (tr as HTMLElement).innerText.replace(/\s+/g, " ").trim().slice(0, 240)));
    await page.locator("#evidence details.evidence summary").first().click();
    await page.locator("#evidence details.evidence summary").nth(1).click();
    const copyTexts = (await page.locator("#evidence pre.ev-text").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim());
    (report["step5"] as Json)["evidenceTrail"] = { heading: evidenceHeading, rows: evRows.length, firstRows: evRows.slice(0, 3), requestSummaries: copyTexts.slice(0, 3) };
    (report["step5"] as Json)["forbiddenInPage"] = {
      xApiKey: /x-api-key/i.test(bodyText) || /x-api-key/i.test(await page.content()),
      authorization: /authorization/i.test(bodyText),
      qlooHost: /hackathon\.api\.qloo\.com/i.test(await page.content()),
      apiKeyOrBearerWording: /api[-_ ]?key|bearer\s/i.test(copyTexts.join(" ")),
    };

    await page.locator("#cities").scrollIntoViewIfNeeded();
    await page.getByText(/City strength loaded/).waitFor({ timeout: 90_000 });
    const lazy = await page.getByText(/City strength loaded[^.]*\.[^.]*\./).first().innerText();
    const cityCalls = apiCalls.filter((c) => c.includes("/cities"));
    const thin = await page.getByRole("list", { name: "Cities with thin data" }).allInnerTexts().catch(() => [] as string[]);
    const noData = await page.getByText("Qloo returned no usable audience data there.").count();
    report["step6"] = {
      cityRequestsBeforeActOpened: cityCallsBeforeOpen,
      cityRequestsAfterScroll: cityCalls.length,
      secondsFromOpenToStripLoaded: secs(Date.now() - tOpen),
      announcement: lazy,
      thinDataList: thin.map((t) => t.replace(/\s+/g, " ").trim().slice(0, 300)),
      noDataRows: noData,
      thinBadgeCount: await page.getByText("Thin data", { exact: false }).count(),
    };
    await page.waitForTimeout(3000); // the page re-reads its server part after the first city load
    report["actPageEvidenceAfterCities"] = (await page.getByRole("heading", { name: /Evidence trail/ }).first().innerText()).trim();
    await page.reload();
    await page.waitForLoadState("networkidle");
    report["actPageEvidenceAfterReload"] = (await page.getByRole("heading", { name: /Evidence trail/ }).first().innerText()).trim();
    await page.screenshot({ path: process.env["M2_GATE_SHOTS"] ? `${process.env["M2_GATE_SHOTS"]}/act-cities.png` : "/dev/null", fullPage: true }).catch(() => undefined);

    // Step 8: share link, clean context.
    await page.goto(slateUrl);
    await page.getByRole("heading", { level: 1, name: /Slate for/ }).waitFor();
    const link = await page.getByLabel("Link to this slate").inputValue();
    const clean = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p2 = await clean.newPage();
    const cleanProblems: string[] = [];
    p2.on("console", (m) => m.type() === "error" && cleanProblems.push(m.text().slice(0, 140)));
    p2.on("pageerror", (e) => cleanProblems.push(e.message.slice(0, 140)));
    const res = await p2.goto(link);
    const headers = res?.headers() ?? {};
    const csp = headers["content-security-policy"] ?? "";
    const robotsMeta = await p2.locator('meta[name="robots"]').getAttribute("content");
    const sharedText = await p2.locator("body").innerText();
    const hostile = await p2.evaluate(() => document.querySelectorAll("script:not([nonce]):not([src])").length);
    report["step8"] = {
      shareLinkShape: link.replace(/[A-Za-z0-9_-]{21}$/, ":id"),
      cleanSessionStatus: res?.status(),
      xRobotsTag: headers["x-robots-tag"] ?? null,
      metaRobots: robotsMeta,
      cspPresent: csp.length > 0,
      cspScriptSrc: (csp.match(/script-src[^;]*/)?.[0] ?? "").replace(/'nonce-[^']+'/, "'nonce-<n>'"),
      cspHasUnsafeInlineOrEvalInScriptSrc: /script-src[^;]*('unsafe-inline'|'unsafe-eval')/.test(csp),
      cspFrameAncestors: csp.match(/frame-ancestors[^;]*/)?.[0] ?? null,
      cacheControl: headers["cache-control"] ?? null,
      bannerOnSharedPage: sharedText.includes("aggregate affinity, not a ticket forecast"),
      sharedPageHasCopyButton: await p2.getByRole("button", { name: "Copy link" }).count(),
      inlineScriptsWithoutNonce: hostile,
      consoleOrCspErrors: cleanProblems,
      plainTextOnly: { scriptTagsInBody: await p2.locator("main script").count() },
      sameActsAsOwnerPage: (await p2.locator("article").count()),
    };
    await clean.close();
  }
  report["problems"] = problems;
  await context.close();
  return report;
}

const browser = await chromium.launch();
const out: Json = { base, startedAt: new Date().toISOString(), room: { city: ROOM.city, crowd: ROOM.crowd.length, candidates: ROOM.candidates.length }, runs: [] };
for (let i = 1; i <= runs; i++) {
  const r = await oneRun(browser, i === 1 || process.env["M2_GATE_FULL"] === "1");
  (out["runs"] as Json[]).push({ run: i, kind: i === 1 ? "first run (full storyboard walk)" : "repeat of the same room (cached)", ...r });
  console.error(`run ${i}: ${JSON.stringify(r["timing"])}`);
}
await browser.close();
const text = JSON.stringify(out, null, 2);
if (outFile) writeFileSync(outFile, text);
console.log(text);
