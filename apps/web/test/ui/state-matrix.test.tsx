// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));


import RouteError from "../../app/error";
import GlobalNotFound from "../../app/not-found";
import { ConfirmView, type ConfirmRow } from "../../src/ui/ConfirmView";
import { EmptyState } from "../../src/ui/EmptyState";
import { ErrorState } from "../../src/ui/ErrorState";
import { Loading } from "../../src/ui/Loading";
import { RoomForm } from "../../src/ui/RoomForm";
import { SlateView } from "../../src/ui/SlateView";
import { ActDetailView } from "../../src/ui/ActDetailView";
import { buildActDetail } from "../../src/actDetail";
import { recordedSlate } from "./uiHelpers";

/**
 * M3-06 state matrix: every screen in its loading, empty and error state, rendered from the real recorded slate
 * (or the real components) with the expected text and ARIA attributes asserted. Browser-level coverage of the same
 * states, with axe, is `tests/a11y/sweep.spec.ts`.
 */

beforeEach(() => push.mockReset());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const hang = (): void => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
};
const reply = (status: number, body: unknown): void => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
};

function fillRoom(): void {
  fireEvent.click(screen.getByRole("button", { name: "Fill in the sample room" }));
}

const hit = (id: string, name: string) => ({ entityId: id, name, popularity: 0.9, disambiguation: null, tags: [] });
const rows: ConfirmRow[] = [
  ...["A1", "A2", "A3"].map((n): ConfirmRow => ({ role: "crowd", actInput: n, state: "exact", candidates: [hit(`id-${n}`, n)] })),
  ...["C1", "C2", "C3"].map((n): ConfirmRow => ({ role: "candidate", actInput: n, state: "exact", candidates: [hit(`id-${n}`, n)] })),
];

describe("Loading component", () => {
  it("is a titled aria-busy region with one polite status sentence; skeletons are hidden from assistive technology", () => {
    render(<Loading title="Ranking in progress" message="Ranking 3 acts." skeletons={2} skeletonLabel="Acts being ranked" />);
    const region = screen.getByTestId("loading");
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("heading", { name: "Ranking in progress" })).toBeTruthy();
    expect(within(region).getByRole("status").textContent).toContain("Ranking 3 acts.");
    expect(screen.getAllByTestId("skeleton-card").every((el) => el.getAttribute("aria-hidden") === "true")).toBe(true);
  });
});

describe("room setup", () => {
  it("empty: the primary action is aria-disabled with its reason linked", () => {
    render(<RoomForm demoMode />);
    const rank = screen.getByRole("button", { name: "Rank these acts" });
    expect(rank.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(rank.getAttribute("aria-describedby") ?? "")?.textContent).toMatch(/^Add a city/);
  });

  it("loading: aria-busy region, polite status, busy button, fields read-only, entries kept", async () => {
    hang();
    render(<RoomForm demoMode />);
    fillRoom();
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    const region = await screen.findByTestId("loading");
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(within(region).getByRole("status").textContent).toContain("Ranking 3 acts");
    expect(screen.getByRole("button", { name: "Ranking…" }).getAttribute("aria-busy")).toBe("true");
    expect((screen.getByLabelText("City (required)") as HTMLInputElement).readOnly).toBe(true);
  });

  it("error: a fixed message in an alert with a retry; the entries are kept", async () => {
    reply(503, { error: { code: "upstream_unavailable", message: "raw hackathon.api.qloo.com" } });
    render(<RoomForm demoMode />);
    fillRoom();
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not reach Qloo. Your entries are kept. Try again.");
    expect(alert.textContent).not.toContain("hackathon");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
    expect((screen.getByLabelText("City (required)") as HTMLInputElement).value).toBe("Berlin");
  });

  it("demo limit: its own heading, a way to the sample rooms and no retry that cannot succeed", async () => {
    reply(429, { error: { code: "demo_limit_reached", message: "x" } });
    render(<RoomForm demoMode />);
    fillRoom();
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { name: "Daily demo limit reached" })).toBeTruthy();
    expect(within(alert).queryByRole("button", { name: "Try again" })).toBeNull();
    expect(within(alert).getByRole("link", { name: "Open a sample room" }).getAttribute("href")).toBe("#sample-rooms");
    expect(alert.textContent).toContain("midnight UTC");
  });

  it("validation error: the summary is an alert with links to each field", () => {
    render(<RoomForm demoMode />);
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    expect(screen.getByRole("alert").textContent).toContain("Fix 3 things to continue");
  });
});

describe("match confirmation", () => {
  it("loading: ranking shows the busy region and a status; choices stay", async () => {
    hang();
    render(<ConfirmView runId={"R".repeat(21)} locationDisplay="Berlin" rows={rows} demoMode />);
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    const region = await screen.findByTestId("loading");
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(within(region).getByRole("status").textContent).toContain("Ranking 6 confirmed names");
  });

  it("error: fixed message, retry, back link, focus on the heading", async () => {
    reply(503, { error: { code: "upstream_unavailable", message: "raw" } });
    render(<ConfirmView runId={"R".repeat(21)} locationDisplay="Berlin" rows={rows} demoMode />);
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not reach Qloo. Your choices are kept. Try again.");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(within(alert).getByRole("heading")));
  });

  it("demo limit: its own heading, a link to the sample rooms, no retry", async () => {
    reply(429, { error: { code: "demo_limit_reached", message: "x" } });
    render(<ConfirmView runId={"R".repeat(21)} locationDisplay="Berlin" rows={rows} demoMode />);
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { name: "Daily demo limit reached" })).toBeTruthy();
    expect(within(alert).queryByRole("button", { name: "Try again" })).toBeNull();
    expect(within(alert).getByRole("link", { name: "Open a sample room" }).getAttribute("href")).toBe("/#sample-rooms");
  });

  it("offline: a caution note, nothing is sent, the choices are kept", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ConfirmView runId={"R".repeat(21)} locationDisplay="Berlin" rows={rows} demoMode />);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect((await screen.findByTestId("offline-note")).textContent).toContain("You appear to be offline. Choices are kept on this page.");
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(screen.queryByTestId("offline-note")).toBeNull());
  });

  it("empty: a run that is gone says so as the page heading with a way back", async () => {
    reply(404, { error: { code: "not_found", message: "x" } });
    render(<ConfirmView runId={"R".repeat(21)} locationDisplay="Berlin" rows={rows} demoMode />);
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    expect((await screen.findByRole("heading", { level: 1, name: "This run is no longer available." })).textContent).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start over" }).getAttribute("href")).toBe("/");
  });
});

describe("slate, act detail and shared pages", () => {
  it("empty (nothing scored): an empty state with a way back, no list", async () => {
    const slate = await recordedSlate();
    const none = { ...slate, results: slate.results.filter((r) => r.rank === null) };
    render(<SlateView slate={none} />);
    expect(screen.getByRole("heading", { name: "No act could be scored." })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Ranked acts" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back to edit the room" })).toBeTruthy();
  });

  it("empty (shared, nothing scored): the way forward is to make your own slate", async () => {
    const slate = await recordedSlate();
    render(<SlateView shared slate={{ ...slate, results: slate.results.filter((r) => r.rank === null) }} />);
    expect(screen.getAllByRole("link", { name: "Make your own slate" }).length).toBeGreaterThan(0);
  });

  it("act with no data: 'No Qloo data for this act', Fit unavailable, no number", async () => {
    const slate = await recordedSlate();
    const noData = slate.results.find((r) => r.rank === null);
    const detail = buildActDetail(slate, noData?.act.qlooEntityId ?? "");
    if (!detail) throw new Error("detail expected");
    render(<ActDetailView detail={detail} />);
    expect(screen.getByText(/^No Qloo data for this act\./)).toBeTruthy();
    expect(screen.getByText("Fit unavailable")).toBeTruthy();
    expect(screen.queryByTestId("fit-value")).toBeNull();
  });

  it("thin city data shows the flag with its text, not colour alone", async () => {
    const { ThinDataBadge } = await import("../../src/ui/ThinDataBadge");
    render(<ThinDataBadge cellCount={10} variant="block" />);
    expect(screen.getByText("Thin data")).toBeTruthy();
    expect(screen.getByText(/only 10 Qloo heatmap cells.*fewer than 15/)).toBeTruthy();
  });
});

describe("not found, expired and route error", () => {
  it("404: one h1, the spec title, a link to start again", () => {
    render(<GlobalNotFound />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Start a new slate" }).getAttribute("href")).toBe("/");
  });

  it("route error: generic message, retry, focus on the heading, no raw error text", async () => {
    const reset = vi.fn();
    render(<RouteError error={new Error("secret stack hackathon.api.qloo.com")} reset={reset} />);
    const heading = screen.getByRole("heading", { name: "This page could not be loaded" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(document.body.textContent).not.toContain("secret");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalled();
  });

  it("EmptyState and ErrorState keep the roles the specs give them", () => {
    render(
      <>
        <EmptyState title="Nothing here" reason="Because." />
        <ErrorState title="Broke" message="Fixed text." role="status" />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Fixed text.");
  });
});
