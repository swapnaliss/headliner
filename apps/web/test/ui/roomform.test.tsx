// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { RoomForm } from "../../src/ui/RoomForm";

function addAct(label: string, name: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: "Enter" });
}

function fillValid() {
  fireEvent.click(screen.getByRole("button", { name: "Fill in the sample room" }));
}

beforeEach(() => {
  push.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RoomForm", () => {
  it("starts with the primary action aria-disabled (not natively disabled) and a linked reason", () => {
    render(<RoomForm demoMode />);
    const button = screen.getByRole("button", { name: "Rank these acts" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    const reasonId = button.getAttribute("aria-describedby");
    expect(document.getElementById(reasonId ?? "")?.textContent).toBe("Add a city, at least 3 crowd acts and at least 3 candidate acts to continue.");
  });

  it("adds with Enter, shows counters, removes with a labelled button and announces it", () => {
    render(<RoomForm demoMode={false} />);
    addAct("Add a crowd act", "Apparat");
    addAct("Add a crowd act", "Moderat");
    expect(screen.getByText("2 of 6 added")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Remove .*Apparat.* from crowd acts/ }));
    expect(screen.getByText("1 of 6 added")).toBeTruthy();
    expect(screen.getByTestId("live-region").textContent).toContain("removed. 1 crowd act left.");
  });

  it("shows a specific inline error tied to the field with aria-describedby and aria-invalid", () => {
    render(<RoomForm demoMode={false} />);
    addAct("Add a crowd act", "Apparat");
    addAct("Add a crowd act", "apparat");
    const input = screen.getByLabelText("Add a crowd act");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = (input.getAttribute("aria-describedby") ?? "").split(" ");
    const texts = describedBy.map((id) => document.getElementById(id)?.textContent ?? "");
    expect(texts.join(" ")).toContain("apparat is already in this list.");
  });

  it("an incomplete submit moves focus to the error summary listing each problem as a link to its field", async () => {
    render(<RoomForm demoMode={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    const summary = await screen.findByRole("alert");
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(summary.textContent).toContain("Fix 3 things to continue");
    const link = screen.getByRole("link", { name: "Enter the city your regular crowd lives in." });
    fireEvent.click(link);
    expect(document.activeElement?.id).toBe("city-field");
    expect(screen.getByLabelText("City (required)").getAttribute("aria-invalid")).toBe("true");
  });

  it("submits the sample room to /api/slates and opens the slate page", async () => {
    const fetchMock = vi.fn(async () => Response.json({ status: "done", id: "abcdefghijklmnopqrstu", slate: {} }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RoomForm demoMode />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/slates/abcdefghijklmnopqrstu"));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/slates");
    expect(JSON.parse(String(init.body))).toEqual({
      city: "Berlin",
      crowdActs: ["Apparat", "Moderat", "Modeselektor", "Hundreds", "Brandt Brauer Frick", "Boys Noize"],
      candidateActs: ["Khruangbin", "Radiohead", "Reality Club"],
    });
  });

  it("a failed request shows the generic error with retry, keeps entries and never shows upstream text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: { code: "upstream_unavailable", message: "X-Api-Key abc hackathon.api.qloo.com stack trace" } }, { status: 503 })),
    );
    render(<RoomForm demoMode={false} />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not reach Qloo. Your entries are kept. Try again.");
    expect(alert.textContent).not.toMatch(/X-Api-Key|hackathon|stack/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect((screen.getByLabelText("City (required)") as HTMLInputElement).value).toBe("Berlin");
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the ranking progress with a live region while a request is in flight", async () => {
    let release: (r: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (release = resolve))));
    render(<RoomForm demoMode={false} />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    const busy = await screen.findByRole("button", { name: "Ranking…" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(screen.getAllByRole("status").some((s) => s.textContent?.includes("Ranking 3 acts"))).toBe(true);
    await act(async () => {
      release(Response.json({ status: "awaiting_confirmation", ambiguous: [{}] }));
    });
    expect(await screen.findByText("Some matches need confirmation")).toBeTruthy();
  });
});
