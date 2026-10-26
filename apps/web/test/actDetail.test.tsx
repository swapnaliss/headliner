// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActResult, Slate } from "@headliner/core";
import { GET } from "../app/api/slates/[id]/acts/[actId]/route";
import { setRuntimeForTests } from "../src/config";
import { actDetailPath, buildActDetail } from "../src/actDetail";
import { createSlate } from "../src/pipeline/createSlate";
import { ActDetailView } from "../src/ui/ActDetailView";
import { fixtureTransport, FIXTURE_DIR, ROOM, runtimeWith } from "./helpers";
import { recordedSlate } from "./ui/uiHelpers";

const CANARY = process.env["CANARY_KEY"] ?? "canary-xyz-123";
const COMPARE_FIXTURE: Record<string, string> = {
  "Reality Club": "compare--list6-crowd-vs-reality-club.json",
  Radiohead: "compare--list6-crowd-vs-radiohead.json",
  Khruangbin: "compare--list6-crowd-vs-khruangbin.json",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setRuntimeForTests(undefined);
});

function resultNamed(slate: Slate, name: string): ActResult {
  const found = slate.results.find((r) => r.act.name === name);
  if (!found) throw new Error(`no result ${name}`);
  return found;
}

function detailOf(slate: Slate, name: string) {
  const detail = buildActDetail(slate, resultNamed(slate, name).act.qlooEntityId);
  if (!detail) throw new Error("no detail");
  return detail;
}

describe("shared tastes equal the recorded compare fixture", () => {
  for (const [name, file] of Object.entries(COMPARE_FIXTURE)) {
    it(`${name}: every rendered tag and score is a value from ${file}`, async () => {
      const slate = await recordedSlate();
      const recorded = (JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8")) as { body: { results: { tags: { tag_id: string; name: string; query: { score: number } }[] } } }).body.results.tags;
      const detail = detailOf(slate, name);
      render(<ActDetailView detail={detail} />);
      const toggle = screen.queryByRole("button", { name: /^Show all/ });
      if (toggle) fireEvent.click(toggle);
      const table = screen.getByRole("table");
      const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) => [tr.querySelector("th")?.textContent ?? "", tr.querySelector("td")?.textContent ?? ""]);
      expect(rows.length).toBe(detail.sharedTastes.length);
      expect(rows.length).toBeGreaterThan(0);
      for (const [tagName, score] of rows) {
        const matches = recorded.filter((t) => t.name === tagName).map((t) => t.query.score.toFixed(2));
        expect(matches, `tag ${tagName}`).toContain(score);
      }
      // Strongest first, as recorded.
      const scores = rows.map((r) => Number(r[1]));
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    });
  }
});

describe("every rendered number maps to evidence", () => {
  it("each Fit, tag score, standing and standing-explanation value carries a non-empty index that exists in the trail", async () => {
    const slate = await recordedSlate();
    for (const result of slate.results) {
      const detail = buildActDetail(slate, result.act.qlooEntityId);
      expect(detail).not.toBeNull();
      if (!detail) continue;
      const known = new Set(detail.evidence.map((e) => e.index));
      const lists: (readonly number[])[] = [];
      if (detail.fit) lists.push(detail.fit.evidenceIndexes);
      for (const t of detail.sharedTastes) lists.push(t.evidenceIndexes);
      if (detail.standing) lists.push(detail.standing.evidenceIndexes);
      if (detail.standingExplanation) lists.push([detail.standingExplanation.candidateEvidenceIndex], detail.standingExplanation.crowdEvidenceIndexes);
      for (const list of lists) {
        expect(list.length).toBeGreaterThan(0);
        for (const n of list) expect(known.has(n)).toBe(true);
      }
      // A value is only present when it has evidence: no fit means no tags.
      if (!detail.fit) expect(detail.sharedTastes).toEqual([]);
    }
  });

  it("every 'See evidence' link on the page targets a row that exists", async () => {
    const slate = await recordedSlate();
    const { container } = render(<ActDetailView detail={detailOf(slate, "Reality Club")} />);
    const links = Array.from(container.querySelectorAll('a[href^="#ev-"]'));
    expect(links.length).toBeGreaterThan(2);
    for (const a of links) {
      const id = (a.getAttribute("href") ?? "").slice(1);
      expect(container.querySelector(`#${id}`), id).not.toBeNull();
    }
  });

  it("evidence rows list endpoint, redacted parameters, digest and what each supports", async () => {
    const slate = await recordedSlate();
    const detail = detailOf(slate, "Reality Club");
    const compare = detail.evidence.find((e) => e.endpoint === "/v2/insights/compare");
    expect(compare?.supports).toEqual(["Fit", "Shared tastes"]);
    expect(compare?.responseDigest).toMatch(/^[a-f0-9]{64}$/);
    const searches = detail.evidence.filter((e) => e.endpoint === "/search");
    expect(searches.length).toBe(7);
    expect(searches.every((e) => e.supports.includes("Qloo popularity rank"))).toBe(true);
    const { container } = render(<ActDetailView detail={detail} />);
    expect(screen.getByRole("heading", { level: 2, name: "Evidence trail (8 calls)" })).toBeTruthy();
    expect(container.querySelectorAll("li.ev-row").length).toBe(8);
    expect(container.textContent).toContain("Request headers, including the API key, are never stored or shown.");
  });

  it("standing is labelled Qloo popularity rank and explained from structured fields", async () => {
    const slate = await recordedSlate();
    const detail = detailOf(slate, "Reality Club");
    expect(detail.standing?.caption).toBe("Qloo popularity rank");
    expect(detail.standingExplanation).toMatchObject({ candidatePercentile: 86.4, crowdMedianPercentile: 99.5, crowdSample: 6, candidateEvidenceIndex: 1 });
    render(<ActDetailView detail={detail} />);
    expect(screen.getAllByText("86.4 of 100 vs crowd median 99.5").length).toBe(2);
    expect(screen.getAllByText("Below crowd median").length).toBeGreaterThan(0);
  });

  it("a slate stored before M2-02 (no standingExplanation) still gets the explanation", async () => {
    const slate = await recordedSlate();
    const stripped: Slate = { ...slate, results: slate.results.map((r) => ({ ...r, standingExplanation: undefined })) };
    const detail = detailOf(stripped, "Reality Club");
    expect(detail.standingExplanation?.crowdEvidenceIndexes.length).toBe(6);
  });
});

describe("an act with no data", () => {
  it("shows the honest empty state, the no_data caveat and no number", async () => {
    const slate = await recordedSlate();
    const detail = detailOf(slate, "Hindia");
    expect(detail.fit).toBeNull();
    expect(detail.standing).toBeNull();
    expect(detail.standingExplanation).toBeNull();
    expect(detail.sharedTastes).toEqual([]);
    expect(detail.rank).toBeNull();
    expect(detail.caveats.map((c) => c.code)).toContain("no_data");
    const { container } = render(<ActDetailView detail={detail} />);
    expect(screen.getByText(/^No Qloo data for this act\./)).toBeTruthy();
    expect(screen.getByText("Not ranked")).toBeTruthy();
    expect(screen.queryByTestId("fit-value")).toBeNull();
    expect(container.textContent).not.toMatch(/of 100/);
    expect(container.querySelector("table")).toBeNull();
    expect(screen.getByText("Fit unavailable")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: /^Evidence trail \(\d+ calls?\)$/ })).toBeTruthy();
    expect(detail.evidence.every((e) => e.supports.length === 0)).toBe(true);
  });

  it("an act whose compare returns no tags is no-data, not a zero", async () => {
    const slate = await recordedSlate();
    const base = resultNamed(slate, "Radiohead");
    const emptied: ActResult = {
      ...base,
      status: "no-data",
      rank: null,
      fit: null,
      overlapTags: [],
      caveats: [{ type: "no-data", message: "Qloo returned no shared audience tags for this act, so no audience-taste fit is shown." }],
      evidence: base.evidence.filter((e) => e.endpoint === "/search"),
      standing: base.standing && { ...base.standing, evidenceRefs: base.evidence.filter((e) => e.endpoint === "/search").map((e) => e.id) },
      standingExplanation: null,
    };
    const next: Slate = { ...slate, results: slate.results.map((r) => (r === base ? emptied : r)) };
    const detail = detailOf(next, "Radiohead");
    expect(detail.fit).toBeNull();
    expect(detail.sharedTastes).toEqual([]);
    expect(detail.caveats.some((c) => c.code === "no_data")).toBe(true);
    render(<ActDetailView detail={detail} />);
    expect(screen.queryByTestId("fit-value")).toBeNull();
    expect(screen.getByText("Fit unavailable")).toBeTruthy();
  });
});

describe("plain text and wording", () => {
  it("a hostile act name and tag render as text with no element made from them", async () => {
    const slate = await recordedSlate();
    const base = resultNamed(slate, "Reality Club");
    const hostile = "<img src=x onerror=alert(1)>";
    const evil: ActResult = { ...base, act: { ...base.act, name: hostile }, overlapTags: base.overlapTags.map((t, i) => (i === 0 ? { ...t, name: hostile } : t)) };
    const next: Slate = { ...slate, results: slate.results.map((r) => (r === base ? evil : r)) };
    const detail = buildActDetail(next, evil.act.qlooEntityId);
    if (!detail) throw new Error("no detail");
    const { container } = render(<ActDetailView detail={detail} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(hostile);
    expect(container.querySelectorAll("a[href]").length).toBeGreaterThan(0);
    for (const a of Array.from(container.querySelectorAll("a[href]"))) expect(a.getAttribute("href")).not.toContain("onerror");
  });

  it("the detail page names standing 'Qloo popularity rank' and never uses forecast words", async () => {
    const slate = await recordedSlate();
    for (const name of ["Reality Club", "Radiohead", "Khruangbin", "Hindia"]) {
      const { container, unmount } = render(<ActDetailView detail={detailOf(slate, name)} />);
      const text = container.textContent ?? "";
      expect(text).not.toMatch(/forecast|turnout|will sell|momentum|trending|growth/i);
      expect(text).not.toMatch(/[↑↓▲▼]/);
      if (name !== "Hindia") expect(text).toContain("Qloo popularity rank");
      unmount();
    }
  });

  it("the words forecast, turnout and will sell appear in app and ui source only inside the banner negation", () => {
    const root = resolve(__dirname, "..");
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|css)$/.test(p)) files.push(p);
      }
    };
    walk(join(root, "app"));
    walk(join(root, "src"));
    const offenders = files.flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .filter((line) => /forecast|turnout|will sell/i.test(line) && !/not a ticket forecast/i.test(line))
        .map((line) => `${f}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe("GET /api/slates/:id/acts/:actId", () => {
  async function seeded() {
    const transport = fixtureTransport();
    const runtime = runtimeWith(transport);
    setRuntimeForTests(runtime);
    const outcome = await createSlate(ROOM, runtime);
    if (outcome.status !== "done") throw new Error("expected done");
    return { runtime, slate: outcome.slate, transport };
  }
  const call = (id: string, actId: string) => GET(new Request("http://localhost/x"), { params: Promise.resolve({ id, actId }) });

  it("returns the detail from the stored slate with no new Qloo call and redacted evidence only", async () => {
    const { slate, transport } = await seeded();
    const before = transport.calls.length;
    expect(before).toBeGreaterThan(0);
    const target = resultNamed(slate, "Reality Club");
    const res = await call(slate.id, encodeURIComponent(target.act.qlooEntityId));
    expect(res.status).toBe(200);
    expect(transport.calls.length).toBe(before);
    const text = await res.text();
    const body = JSON.parse(text) as { act: { name: string }; evidence: Record<string, unknown>[]; fit: { value: number } };
    expect(body.act.name).toBe("Reality Club");
    expect(body.fit.value).toBe(target.fit?.value);
    expect(body.evidence.length).toBe(8);
    expect(Object.keys(body.evidence[0] ?? {}).sort()).toEqual(["endpoint", "fetchedAt", "id", "index", "params", "responseDigest", "status", "supports"]);
    expect(text).not.toMatch(/x-api-key|authorization|headers/i);
    expect(text.split(CANARY).length - 1).toBe(0);
  });

  it("answers 404 with the fixed error for an unknown slate, a malformed id and an unknown act", async () => {
    const { slate } = await seeded();
    for (const [id, act] of [
      ["A".repeat(21), "x"],
      ["not-an-id", "x"],
      [slate.id, "00000000-0000-0000-0000-000000000000"],
      [slate.id, "x".repeat(500)],
      [slate.id, "a\nb"],
    ] as const) {
      const res = await call(id, act);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: { code: "not_found", message: "This slate or act was not found." } });
    }
  });

  it("a failing store surfaces a generic error and never the upstream body", async () => {
    const logs: string[] = [];
    for (const m of ["log", "info", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(" ")));
    const runtime = runtimeWith(fixtureTransport());
    const leak = `UPSTREAM-LEAK-MARKER ${CANARY} /srv/qloo/internal.ts`;
    runtime.store.get = async () => {
      throw new Error(leak);
    };
    setRuntimeForTests(runtime);
    const res = await call("A".repeat(21), "x");
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: "internal_error", message: "Something went wrong on our side." } });
    expect(text).not.toContain("UPSTREAM-LEAK-MARKER");
    expect((text + logs.join("\n")).split(CANARY).length - 1).toBe(0);
    expect(logs.join("\n")).not.toContain("UPSTREAM-LEAK-MARKER");
  });

  it("detail links encode the entity id", () => {
    expect(actDetailPath("A".repeat(21), "unmatched:a b/c")).toBe(`/slates/${"A".repeat(21)}/act/unmatched%3Aa%20b%2Fc`);
  });
});
