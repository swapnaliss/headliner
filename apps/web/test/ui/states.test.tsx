// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActCard } from "../../src/ui/ActCard";
import { Banner } from "../../src/ui/Banner";
import { Button } from "../../src/ui/Button";
import { EmptyState } from "../../src/ui/EmptyState";
import { ErrorState } from "../../src/ui/ErrorState";
import { ProgressStatus } from "../../src/ui/ProgressStatus";
import { SkeletonList } from "../../src/ui/SkeletonCard";
import { SlateView } from "../../src/ui/SlateView";
import { recordedSlate } from "./uiHelpers";

afterEach(cleanup);

describe("loading", () => {
  it("shows skeleton cards hidden from assistive tech plus a polite live region", () => {
    const { container } = render(
      <>
        <ProgressStatus message="Ranking 3 acts." />
        <SkeletonList count={3} label="Acts being ranked" />
      </>,
    );
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Ranking 3 acts.");
    const cards = container.querySelectorAll('[data-testid="skeleton-card"]');
    expect(cards).toHaveLength(3);
    cards.forEach((c) => expect(c.getAttribute("aria-hidden")).toBe("true"));
    expect(container.querySelector("ol")?.getAttribute("aria-busy")).toBe("true");
  });

  it("a loading Button is aria-busy and aria-disabled, never natively disabled, and ignores presses", () => {
    let presses = 0;
    render(
      <Button loading loadingLabel="Ranking…" onClick={() => presses++}>
        Rank these acts
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Ranking…" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    button.click();
    expect(presses).toBe(0);
  });
});

describe("error", () => {
  it("is an alert with a generic message and a retry; no raw upstream text", () => {
    render(<ErrorState title="Could not rank these acts" message="Could not reach Qloo. Your entries are kept. Try again." actions={<Button variant="secondary">Try again</Button>} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Could not reach Qloo");
    expect(alert.textContent).not.toMatch(/X-Api-Key|hackathon\.api|stack|Error:/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Could not rank these acts");
  });
});

describe("empty and no-data", () => {
  it("an empty state says what is missing and why, never a zero", () => {
    render(<EmptyState title="This slate is no longer available." reason="Slates are kept for 30 days." />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("This slate is no longer available.");
    expect(screen.getByText("Slates are kept for 30 days.")).toBeTruthy();
  });

  it("a no-data act shows the honest empty state, no rank number, no Fit, no Qloo popularity rank value", async () => {
    const slate = await recordedSlate();
    const noData = slate.results.find((r) => r.status === "no-data");
    expect(noData).toBeTruthy();
    const { container } = render(
      <ol>
        <ActCard result={noData!} rankedCount={3} />
      </ol>,
    );
    expect(container.textContent).toContain(`No data for ${noData!.act.name}`);
    expect(container.textContent).toContain("Not ranked");
    expect(container.querySelector(".fit-value")).toBeNull();
    expect(container.textContent).not.toMatch(/\bFit\b\s*\d/);
    expect(container.textContent).not.toContain("of 100");
  });

  it("the slate puts no-data acts last under Not ranked and ranks the scored ones first", async () => {
    const slate = await recordedSlate();
    const { container } = render(<SlateView slate={slate} />);
    const headings = Array.from(container.querySelectorAll("h2")).map((h) => h.textContent);
    expect(headings.indexOf("Ranked acts (3)")).toBeGreaterThanOrEqual(0);
    expect(headings.indexOf("Not ranked (1)")).toBeGreaterThan(headings.indexOf("Ranked acts (3)"));
    const names = Array.from(container.querySelectorAll("h3")).map((h) => h.textContent);
    expect(names.slice(0, 3)).toEqual(["Reality Club", "Radiohead", "Khruangbin"]);
    expect(names[3]).toBe("Hindia");
  });

  it("a slate with nothing scored shows the empty state instead of a list", async () => {
    const slate = await recordedSlate();
    const noneScored = {
      ...slate,
      results: slate.results.map((r) => ({ ...r, status: "no-data" as const, rank: null, fit: null, standing: null, overlapTags: [] })),
    };
    render(<SlateView slate={noneScored} />);
    expect(screen.getByRole("heading", { name: "No act could be scored." })).toBeTruthy();
  });
});

describe("banner", () => {
  it("carries the fixed string and is a labelled note", () => {
    const { container } = render(<Banner />);
    expect(container.textContent).toContain("aggregate affinity, not a ticket forecast");
    expect(screen.getByRole("note", { name: "How to read this page" })).toBeTruthy();
  });
});
