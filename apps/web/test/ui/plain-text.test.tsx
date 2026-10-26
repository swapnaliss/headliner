// @vitest-environment jsdom
import type { ActResult } from "@headliner/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActCard } from "../../src/ui/ActCard";
import { ActChip } from "../../src/ui/ActChip";
import { CaveatList } from "../../src/ui/CaveatChip";
import { EmptyState } from "../../src/ui/EmptyState";
import { SlateView } from "../../src/ui/SlateView";
import { recordedSlate, withName } from "./uiHelpers";

afterEach(cleanup);

const HOSTILE = "<img src=x onerror=alert(1)>";

describe("entity names are plain text", () => {
  it("an ActCard whose name is an img tag renders text with no img element", async () => {
    const slate = await recordedSlate();
    const scored = slate.results.find((r) => r.status === "scored") as ActResult;
    const hostile: ActResult = {
      ...withName(scored, HOSTILE),
      overlapTags: [{ tagId: "t1", name: HOSTILE, score: 0.7 }, ...scored.overlapTags],
      caveats: [{ type: "thin-data", message: "Fewer than 15 cells.", subject: HOSTILE }],
    };
    const { container } = render(
      <ol>
        <ActCard result={hostile} rankedCount={1} />
      </ol>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    const heading = container.querySelector("h3");
    expect(heading?.textContent).toBe(HOSTILE);
    expect(container.textContent).toContain(HOSTILE);
    // No attribute anywhere carries an event handler from the name.
    expect(container.querySelector("[onerror]")).toBeNull();
  });

  it("a hostile act name is plain text in the chip, the empty state, the crowd list and the comparison table", async () => {
    const slate = await recordedSlate();
    const hostileSlate = {
      ...slate,
      room: { city: HOSTILE, crowdActs: slate.room.crowdActs.map((a, i) => (i === 0 ? { ...a, name: HOSTILE } : a)) },
      results: slate.results.map((r, i) => (i < 2 ? withName(r, HOSTILE) : r)),
    };
    const { container } = render(<SlateView slate={hostileSlate} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(HOSTILE);

    const chip = render(
      <ul>
        <ActChip name={HOSTILE} listLabel="crowd acts" onRemove={() => undefined} />
      </ul>,
    );
    expect(chip.container.querySelector("img")).toBeNull();
    expect(chip.container.textContent).toContain(HOSTILE);

    const empty = render(<EmptyState title={`No data for ${HOSTILE}`} reason="Nothing usable." />);
    expect(empty.container.querySelector("img")).toBeNull();
    expect(empty.container.textContent).toContain(HOSTILE);

    const caveats = render(<CaveatList caveats={[{ type: "thin-data", message: "x", subject: HOSTILE }]} />);
    expect(caveats.container.querySelector("img")).toBeNull();
  });

  it("makes no link out of a name", async () => {
    const slate = await recordedSlate();
    const scored = slate.results.find((r) => r.status === "scored") as ActResult;
    const { container } = render(
      <ol>
        <ActCard result={withName(scored, "https://evil.example/ [click](javascript:alert(1))")} rankedCount={1} />
      </ol>,
    );
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});
