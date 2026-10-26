// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildSlateView } from "../../src/slateView";
import { SlateView } from "../../src/ui/SlateView";
import { recordedSlate } from "./uiHelpers";

afterEach(cleanup);

describe("recorded slate on screen", () => {
  it("each scored card shows rank, Fit, tags, labelled standing, evidence count and no arrow or forecast words", async () => {
    const slate = await recordedSlate();
    const { container } = render(<SlateView slate={slate} />);
    const cards = Array.from(container.querySelectorAll("article"));
    expect(cards).toHaveLength(4);
    const first = within(cards[0] as HTMLElement);
    expect(first.getByLabelText("Rank 1 of 3")).toBeTruthy();
    expect(first.getByLabelText("Audience-taste fit 60.6 out of 100")).toBeTruthy();
    expect(first.getByText("Qloo popularity rank")).toBeTruthy();
    expect(first.getByText("Below crowd median")).toBeTruthy();
    expect(first.getByText("86.4 of 100 vs crowd median 99.5")).toBeTruthy();
    expect(first.getByText("Higher is better known on Qloo.")).toBeTruthy();
    expect(first.getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(first.getByText(/Evidence \(\d+ calls?\)/)).toBeTruthy();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/will sell|turnout|forecast(?!\.)|momentum|trending|growth/i);
    expect(text).not.toMatch(/[↑↓▲▼]/);
  });

  it("calls close Fit values close and shows the derived comparison with differing positions", async () => {
    const slate = await recordedSlate();
    render(<SlateView slate={slate} />);
    expect(screen.getByText("Fit values span 2.5 points. Treat neighbouring ranks as close.")).toBeTruthy();
    expect(screen.getByText("The orders differ: 3 of 3 acts sit in a different position.")).toBeTruthy();
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1).map((r) => Array.from(r.querySelectorAll("th,td")).map((c) => c.textContent));
    expect(rows).toEqual([
      ["Reality Club", "1", "3"],
      ["Radiohead", "2", "1"],
      ["Khruangbin", "3", "2"],
    ]);
    expect(screen.getByText("Derived from the Fit and Qloo popularity rank values above.")).toBeTruthy();
  });

  it("view model: tied display Fit values are marked", async () => {
    const slate = await recordedSlate();
    const tiedSlate = {
      ...slate,
      results: slate.results.map((r) => (r.rank === 2 && r.fit ? { ...r, fit: { ...r.fit, value: 60.6 } } : r)),
    };
    const view = buildSlateView(tiedSlate);
    expect(view.tied.size).toBe(1);
  });
});
