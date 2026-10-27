// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import Home from "../../app/page";
import { DemoLimits } from "../../src/ui/DemoLimits";
import { RoomForm } from "../../src/ui/RoomForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("demo-limits note", () => {
  it("states the daily per-visitor limit, that sample rooms are always available, and that there is no login or CAPTCHA", () => {
    render(<DemoLimits recorded={false} dailyQlooCalls={150} />);
    const note = screen.getByRole("region", { name: "Demo limits" });
    expect(note.textContent).toContain("150 live Qloo calls a day");
    expect(note.textContent).toContain("always available");
    expect(note.textContent).toContain("No login, no CAPTCHA");
    expect(note.textContent).toContain("midnight UTC");
  });

  it("in recorded-responses mode says the limits are off and names the live limit", () => {
    render(<DemoLimits recorded dailyQlooCalls={150} />);
    const note = screen.getByTestId("demo-limits");
    expect(note.textContent).toContain("Daily limits are off in this recorded-responses demo");
    expect(note.textContent).toContain("150 live Qloo calls a day");
    expect(note.textContent).toContain("always available");
  });

  it("is on the intake page, with the default limit and one h2", () => {
    vi.stubEnv("DEMO_MODE", "fixtures");
    vi.stubEnv("BUDGET_IP_QLOO_CALLS", "");
    render(<Home />);
    expect(screen.getByRole("region", { name: "Demo limits" }).textContent).toContain("150");
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1);
  });

  it("shows the configured limit, not a hard-coded one", () => {
    vi.stubEnv("DEMO_MODE", "live");
    vi.stubEnv("BUDGET_IP_QLOO_CALLS", "75");
    render(<Home />);
    expect(screen.getByTestId("demo-limits").textContent).toContain("75 live Qloo calls a day");
  });
});

describe("the daily-limit answer on the intake form", () => {
  it("shows the daily-limit message (not 'busy') for a demo_limit_reached 429, and keeps the entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { code: "demo_limit_reached", message: "x" } }), { status: 429, headers: { "retry-after": "3600" } })),
    );
    render(<RoomForm demoMode={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Fill in the sample room" }));
    fireEvent.click(screen.getByRole("button", { name: "Rank these acts" }));
    await waitFor(() => expect(screen.getByText(/reached its daily limit for live Qloo lookups/)).toBeTruthy());
    expect(screen.getByText(/sample rooms above still work/)).toBeTruthy();
    expect(screen.queryByText(/busy right now/)).toBeNull();
  });
});
