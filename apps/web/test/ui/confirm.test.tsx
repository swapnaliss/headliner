// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ConfirmView, type ConfirmRow } from "../../src/ui/ConfirmView";
import { summarise, toChoices } from "../../src/confirmRules";

const hit = (entityId: string, name: string, extra: Partial<{ tags: string[]; disambiguation: string | null; popularity: number }> = {}) => ({
  entityId,
  name,
  popularity: extra.popularity ?? 0.5,
  tags: extra.tags ?? ["Indie", "Pop"],
  disambiguation: extra.disambiguation ?? null,
});

const EXACT = (role: "crowd" | "candidate", name: string): ConfirmRow => ({ role, actInput: name, state: "exact", candidates: [hit(`ID-${name}`, name)] });

function rows(overrides: ConfirmRow[] = []): ConfirmRow[] {
  return [
    EXACT("crowd", "Apparat"),
    EXACT("crowd", "Moderat"),
    EXACT("crowd", "Modeselektor"),
    EXACT("candidate", "Khruangbin"),
    EXACT("candidate", "Radiohead"),
    ...overrides,
  ];
}

const PHOENIX: ConfirmRow = {
  role: "candidate",
  actInput: "Phoenix",
  state: "ambiguous",
  candidates: [hit("AAAA-1", "Phoenix", { disambiguation: "French band", popularity: 0.9995, tags: ["Indie Pop", "Indie", "Electronic"] }), hit("AAAA-2", "Phoenix", { disambiguation: "Australian singer", popularity: 0.31 })],
};

const rankButton = (): HTMLElement => screen.getByRole("button", { name: /Rank these acts|Ranking/ });

beforeEach(() => push.mockReset());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ConfirmView", () => {
  it("blocks Rank (aria-disabled, never native disabled) until every ambiguous name is resolved", () => {
    render(<ConfirmView runId="r" locationDisplay="Berlin" rows={rows([PHOENIX])} demoMode={false} />);
    const button = rankButton();
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(false);
    const reason = document.getElementById(button.getAttribute("aria-describedby") ?? "");
    expect(reason?.textContent).toMatch(/1 name still needs your decision: Phoenix\./);
    expect(screen.getByTestId("status-line").textContent).toBe("1 name needs your choice, 5 confirmed.");

    fireEvent.click(screen.getByLabelText(/French band/));
    expect(rankButton().getAttribute("aria-disabled")).toBeNull();
    expect(screen.getByTestId("status-line").textContent).toBe("All 6 names confirmed.");
    expect(screen.getByText("Match chosen by you")).toBeTruthy();
  });

  it("shows name, three tags and the Qloo popularity rank for each option, and preselects nothing", () => {
    render(<ConfirmView runId="r" locationDisplay="Berlin" rows={rows([PHOENIX])} demoMode={false} />);
    const group = screen.getByRole("group", { name: /Which Phoenix\?/ });
    const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    expect(radios.some((r) => r.checked)).toBe(false);
    expect(within(group).getByText("Tags: Indie Pop, Indie, Electronic")).toBeTruthy();
    expect(within(group).getByText("Qloo popularity rank 100.0 of 100 (higher is better known on Qloo)")).toBeTruthy();
    expect(within(group).getByText("None of these")).toBeTruthy();
  });

  it("pressing the blocked button moves focus to the first unresolved name and posts nothing", () => {
    const fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);
    render(<ConfirmView runId="r" locationDisplay="Berlin" rows={rows([PHOENIX])} demoMode={false} />);
    fireEvent.click(rankButton());
    expect(document.activeElement?.tagName).toBe("LEGEND");
    expect(fetchStub).not.toHaveBeenCalled();
    expect(screen.getByTestId("live-region").textContent).toMatch(/still needs your decision/);
  });

  it("sends one choice per ambiguous name to the confirm route and opens the slate", async () => {
    const fetchStub = vi.fn(async () => Response.json({ status: "done", id: "AbCdEfGhIjKlMnOpQrStU", slate: {} }));
    vi.stubGlobal("fetch", fetchStub);
    render(<ConfirmView runId="RUNRUNRUNRUNRUNRUNRUN" locationDisplay="Berlin" rows={rows([PHOENIX])} demoMode={false} />);
    fireEvent.click(screen.getByLabelText(/Australian singer/));
    fireEvent.click(rankButton());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/slates/AbCdEfGhIjKlMnOpQrStU"));
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const call = fetchStub.mock.calls[0] as unknown as [string, { body: string }];
    expect(call[0]).toBe("/api/slates/RUNRUNRUNRUNRUNRUNRUN/confirm");
    expect(JSON.parse(call[1].body)).toEqual({ choices: [{ actInput: "Phoenix", entityId: "AAAA-2" }] });
  });

  it("None of these and Remove act both leave the act out; below the minimum the reason says so", () => {
    render(<ConfirmView runId="r" locationDisplay="Berlin" rows={rows([PHOENIX])} demoMode={false} />);
    fireEvent.click(screen.getByLabelText("None of these"));
    expect(rankButton().getAttribute("aria-disabled")).toBe("true");
    const reason = document.getElementById(rankButton().getAttribute("aria-describedby") ?? "");
    expect(reason?.textContent).toBe("Add another candidate act: only 2 remain.");
    fireEvent.click(screen.getByRole("button", { name: "Put back" }));
    expect(screen.getByText(/1 name still needs your decision/)).toBeTruthy();
  });

  it("explains a name that has no recording or no match and offers only leaving it out", () => {
    const missing: ConfirmRow = { role: "candidate", actInput: "Bjork", state: "not-in-recordings", candidates: [] };
    const none: ConfirmRow = { role: "crowd", actInput: "Xyzzyq", state: "none", candidates: [] };
    render(<ConfirmView runId="r" locationDisplay="Berlin" rows={rows([missing, none])} demoMode />);
    expect(screen.getByText("Bjork is not in the recorded responses")).toBeTruthy();
    expect(screen.getByText(/only has recorded responses and does not include Bjork/)).toBeTruthy();
    expect(screen.getByText("No Qloo match for Xyzzyq")).toBeTruthy();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove act" })[0] as HTMLElement);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove act" })[0] as HTMLElement);
    expect(screen.getByTestId("status-line").textContent).toBe("5 confirmed, 2 left out. Ranking needs more acts.");
  });

  it("shows the city string the heatmap will receive, as text", () => {
    render(<ConfirmView runId="r" locationDisplay={"Tromsø <b>x</b>"} rows={rows([PHOENIX])} demoMode={false} />);
    expect(screen.getByTestId("location-line").textContent).toContain("Tromsø <b>x</b>");
    expect(screen.getByTestId("location-line").querySelector("b")).toBeNull();
  });

  it("keeps the choices and shows a fixed message when ranking fails, and a gone state on 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "upstream_unavailable", message: "SECRET upstream text" } }, { status: 503 })));
    render(<ConfirmView runId="r" locationDisplay="Berlin" rows={rows([PHOENIX])} demoMode={false} />);
    fireEvent.click(screen.getByLabelText(/French band/));
    fireEvent.click(rankButton());
    expect(await screen.findByText("Could not reach Qloo. Your choices are kept. Try again.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("SECRET");
    expect(screen.getByRole("button", { name: "Change" })).toBeTruthy();
    expect(screen.getByText("Match chosen by you")).toBeTruthy();

    cleanup();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "not_found", message: "x" } }, { status: 404 })));
    render(<ConfirmView runId="r" locationDisplay="Berlin" rows={rows([PHOENIX])} demoMode={false} />);
    fireEvent.click(screen.getByLabelText(/French band/));
    await act(async () => {
      fireEvent.click(rankButton());
    });
    expect(await screen.findByText("This run is no longer available.")).toBeTruthy();
  });
});

describe("hostile names render as inert plain text", () => {
  const evil = ["<script>alert(1)</script>", "Evil&filter.type=urn:entity:place", "<img src=x onerror=alert(1)>"];
  const row: ConfirmRow = {
    role: "candidate",
    actInput: evil[2] as string,
    state: "ambiguous",
    candidates: evil.map((name, i) => hit(`EVIL-${i}`, name, { tags: [evil[0] as string], disambiguation: evil[1] as string })),
  };

  it("never creates elements or links from a name, and the choice carries only the entity id", async () => {
    const fetchStub = vi.fn(async () => Response.json({ status: "done", id: "AbCdEfGhIjKlMnOpQrStU", slate: {} }));
    vi.stubGlobal("fetch", fetchStub);
    const { container } = render(<ConfirmView runId="r" locationDisplay="Berlin" rows={rows([row])} demoMode={false} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a[href*='filter']")).toBeNull();
    expect(container.textContent).toContain("Evil&filter.type=urn:entity:place");
    expect(container.textContent).toContain("<script>alert(1)</script>");
    fireEvent.click(screen.getAllByRole("radio")[1] as HTMLElement);
    fireEvent.click(rankButton());
    await waitFor(() => expect(fetchStub).toHaveBeenCalled());
    const call = fetchStub.mock.calls[0] as unknown as [string, { body: string }];
    expect(call[0]).toBe("/api/slates/r/confirm");
    expect(JSON.parse(call[1].body)).toEqual({ choices: [{ actInput: evil[2], entityId: "EVIL-1" }] });
  });
});

describe("confirmRules", () => {
  const list = rows([PHOENIX]);
  it("counts pending, decided and exact rows and builds the choices", () => {
    expect(summarise(list, {}).pending.map((r) => r.actInput)).toEqual(["Phoenix"]);
    const done = summarise(list, { Phoenix: "AAAA-1" });
    expect(done.blockedReason).toBeNull();
    expect(done.confirmed).toBe(6);
    expect(toChoices(list, { Phoenix: "AAAA-1" })).toEqual([{ actInput: "Phoenix", entityId: "AAAA-1" }]);
    expect(toChoices(list, {})).toEqual([]);
  });
  it("cuts the pending list after three names", () => {
    const many = ["A", "B", "C", "D", "E"].map<ConfirmRow>((n) => ({ role: "candidate", actInput: n, state: "none", candidates: [] }));
    const s = summarise([...rows(), ...many], {});
    expect(s.pending).toHaveLength(5);
  });
});
