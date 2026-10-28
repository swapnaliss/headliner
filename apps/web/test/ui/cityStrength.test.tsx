// @vitest-environment jsdom
import type { Slate } from "@headliner/core";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as citiesRoute } from "../../app/api/slates/[id]/acts/[actId]/cities/route";
import { CityStrengthSection } from "../../app/slates/[id]/act/[actId]/CityStrengthSection";
import { setRuntimeForTests } from "../../src/config";
import { fixtureTransport, runtimeWith } from "../helpers";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
import { recordedSlate } from "./uiHelpers";

interface Setup {
  slate: Slate;
  actId: string;
  fetchMock: ReturnType<typeof vi.fn>;
  bodies: { cities: string[] }[];
}

/** Serves the page's fetch calls from the real route handler over the recorded fixtures. */
async function setup(opts: { failCity?: string } = {}): Promise<Setup> {
  const runtime = runtimeWith(fixtureTransport());
  setRuntimeForTests(runtime);
  const slate = await recordedSlate();
  await runtime.store.save(slate);
  const actId = slate.results.find((r) => r.act.name === "Reality Club")?.act.qlooEntityId as string;
  const bodies: { cities: string[] }[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { cities: string[] };
    bodies.push(body);
    if (opts.failCity && body.cities[0] === opts.failCity) throw new TypeError("network down");
    const match = /\/api\/slates\/([^/]+)\/acts\/([^/]+)\/cities$/.exec(url);
    if (!match) throw new Error(`unexpected url ${url}`);
    const request = new Request(`http://localhost${url}`, { method: "POST", body: String(init.body), headers: { "content-type": "application/json" } });
    return citiesRoute(request, { params: Promise.resolve({ id: decodeURIComponent(match[1] as string), actId: decodeURIComponent(match[2] as string) }) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { slate, actId, fetchMock, bodies };
}

const section = (s: Setup, extra: Partial<Parameters<typeof CityStrengthSection>[0]> = {}) => (
  <CityStrengthSection slateId={s.slate.id} actId={s.actId} actName="Reality Club" roomCity="Berlin" {...extra} />
);

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setRuntimeForTests(undefined);
});

describe("CityStrengthSection", () => {
  it("makes no request until the section starts; the fallback button starts it", async () => {
    const s = await setup();
    render(section(s));
    expect(screen.getByRole("heading", { level: 2, name: "Other cities compared" })).toBeTruthy();
    expect(s.fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Load city strength" }));
    await waitFor(() => expect(s.fetchMock).toHaveBeenCalledTimes(5));
    expect(s.bodies.map((b) => b.cities)).toEqual([["Berlin"], ["London"], ["Leipzig"], ["Jakarta"], ["Tromsø"]]);
  });

  it("starts by itself when the observer reports the section near the viewport", async () => {
    const s = await setup();
    let callback: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
          callback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    render(section(s));
    expect(screen.queryByRole("button", { name: "Load city strength" })).toBeNull();
    expect(s.fetchMock).not.toHaveBeenCalled();
    callback?.([{ isIntersecting: true }]);
    await waitFor(() => expect(s.fetchMock).toHaveBeenCalledTimes(5));
  });

  it("ranks enough-data cities by mean affinity rank, groups thin cities apart with the Thin data flag, and shows the no-data state", async () => {
    const s = await setup();
    render(section(s));
    fireEvent.click(screen.getByRole("button", { name: "Load city strength" }));
    await screen.findByText(/City strength loaded for 5 cities\. 2 have thin data\./);

    const ranked = within(screen.getByRole("list", { name: "Cities compared" })).getAllByRole("listitem");
    const rankedText = ranked.map((li) => li.textContent ?? "");
    expect(rankedText[0]).toContain("Jakarta");
    expect(rankedText[0]).toContain("Mean affinity rank 0.780");
    expect(rankedText[0]).toContain("686 cells");
    expect(rankedText[0]).not.toContain("Thin data");
    expect(rankedText[1]).toContain("London");
    expect(rankedText[1]).toContain("44 cells");
    // The zero-cell city is last, in its own labelled group (BL-01 M2-03 item 4), not between ranked and thin cities.
    expect(rankedText).toHaveLength(2);

    expect(screen.getByRole("heading", { level: 3, name: "Thin data: read with caution" })).toBeTruthy();
    const thin = within(screen.getByRole("list", { name: "Cities with thin data" })).getAllByRole("listitem");
    expect(thin.map((li) => li.textContent?.match(/Berlin|Leipzig/)?.[0])).toEqual(["Berlin", "Leipzig"]);
    expect(thin[0]?.textContent).toContain("Thin data");
    expect(thin[0]?.textContent).toContain("only 6 Qloo heatmap cells");
    expect(thin[1]?.textContent).toContain("only 1 Qloo heatmap cell for this city");
    expect(thin[0]?.textContent).toContain("Your venue's city");

    expect(screen.getByRole("heading", { level: 3, name: "No heatmap data" })).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Cities with no heatmap data" })).getByText(/No heatmap cells for/).textContent).toContain("Tromsø");
    expect(screen.getByText("Qloo returned no usable audience data there.")).toBeTruthy();
  });

  it("uses audience-taste wording only: no turnout, sales or forecast claims, no momentum", async () => {
    const s = await setup();
    const { container } = render(section(s));
    fireEvent.click(screen.getByRole("button", { name: "Load city strength" }));
    await screen.findByText(/City strength loaded/);
    expect(container.textContent).not.toMatch(/turnout|will sell|forecast|momentum|trending|rising|growth/i);
    expect(container.textContent).toContain("Qloo rescales raw affinity and popularity inside each city");
  });

  it("a failed city shows an inline error with Try again while the others stay", async () => {
    const s = await setup({ failCity: "London" });
    render(section(s));
    fireEvent.click(screen.getByRole("button", { name: "Load city strength" }));
    await screen.findByText(/Could not load/);
    const failedRow = screen.getByText(/Could not load/).closest("li") as HTMLElement;
    expect(failedRow.textContent).toContain("London");
    expect(within(screen.getByRole("list", { name: "Cities compared" })).getByText("Jakarta")).toBeTruthy();
    expect(screen.queryByText("The rest of this page is unaffected.")).toBeNull();
    // retry: the endpoint is asked again for that city only
    s.fetchMock.mockClear();
    fireEvent.click(within(failedRow).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(s.fetchMock).toHaveBeenCalledTimes(1));
    expect(s.bodies.at(-1)).toEqual({ cities: ["London"] });
  });

  it("when every city fails it shows one error state with Try again and the rest of the page unaffected", async () => {
    const s = await setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    render(section(s));
    fireEvent.click(screen.getByRole("button", { name: "Load city strength" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not load city strength");
    expect(alert.textContent).toContain("The rest of this page is unaffected.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("renders a hostile city name as plain text and never as markup", async () => {
    const s = await setup();
    const { container } = render(section(s, { readOnly: false }));
    const hostile = "<img src=x onerror=alert(1)>";
    fireEvent.click(screen.getByRole("button", { name: /Remove .*Jakarta/ }));
    fireEvent.change(screen.getByLabelText("Compare another city"), { target: { value: hostile } });
    fireEvent.click(screen.getByRole("button", { name: "Add city" }));
    await screen.findByText(/Could not load/);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(hostile);
    expect(screen.getByRole("button", { name: /Remove .*onerror/ })).toBeTruthy();
  });

  it("add-a-city checks: empty, duplicate, control characters, and the 5-city limit", async () => {
    const s = await setup();
    render(section(s));
    const input = screen.getByLabelText("Compare another city");
    const add = screen.getByRole("button", { name: "Add city" });
    fireEvent.click(add);
    expect(screen.getByText("Enter a city name.")).toBeTruthy();
    fireEvent.change(input, { target: { value: "london" } });
    fireEvent.click(add);
    expect(screen.getByText("That city is already compared.")).toBeTruthy();
    fireEvent.change(input, { target: { value: "Ber\u0007lin" } });
    fireEvent.click(add);
    expect(screen.getByText("Remove control characters from the city name.")).toBeTruthy();
    fireEvent.change(input, { target: { value: "x".repeat(81) } });
    fireEvent.click(add);
    expect(screen.getByText("Use 80 characters or fewer.")).toBeTruthy();
    fireEvent.change(input, { target: { value: "Paris" } });
    fireEvent.click(add);
    expect(screen.getByText(/Up to 5 cities are compared for one act/)).toBeTruthy();
  });

  it("removing a compared city drops its row; the room city cannot be removed", async () => {
    const s = await setup();
    render(section(s));
    expect(screen.queryByRole("button", { name: /Remove .*Berlin/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Remove .*Jakarta/ }));
    fireEvent.click(screen.getByRole("button", { name: "Load city strength" }));
    await waitFor(() => expect(s.fetchMock).toHaveBeenCalledTimes(4));
    expect(s.bodies.flatMap((b) => b.cities)).not.toContain("Jakarta");
  });

  it("saved aggregates show immediately and cover the cities without any request; read-only never asks", async () => {
    const s = await setup();
    const stored = s.slate.results.find((r) => r.act.qlooEntityId === s.actId);
    const loaded = render(section(s));
    fireEvent.click(screen.getByRole("button", { name: "Load city strength" }));
    await screen.findByText(/City strength loaded/);
    cleanup();
    loaded.unmount();

    const saved = await (async () => {
      const runtime = (await import("../../src/config")).getRuntime();
      return (await runtime.store.get(s.slate.id))?.results.find((r) => r.act.qlooEntityId === s.actId);
    })();
    expect(saved?.cityStrengths.length).toBe(4);
    expect(stored).toBeTruthy();

    s.fetchMock.mockClear();
    render(section(s, { readOnly: true, persisted: saved?.cityStrengths ?? [], persistedEvidence: saved?.evidence ?? [] }));
    expect(screen.queryByRole("button", { name: "Load city strength" })).toBeNull();
    expect(screen.queryByLabelText("Compare another city")).toBeNull();
    expect(within(screen.getByRole("list", { name: "Cities compared" })).getByText("Jakarta")).toBeTruthy();
    expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it("read-only with nothing saved says so instead of loading", async () => {
    const s = await setup();
    render(section(s, { readOnly: true }));
    expect(screen.getByText("City strength was not loaded for this act on this slate.")).toBeTruthy();
    expect(s.fetchMock).not.toHaveBeenCalled();
  });
});
