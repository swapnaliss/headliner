// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CaveatChip, CaveatList, mergeThinData } from "../../src/ui/CaveatChip";

afterEach(cleanup);

const labels = (container: HTMLElement): (string | null)[] => Array.from(container.querySelectorAll(".status > span")).map((s) => s.textContent);

describe("CaveatChip label", () => {
  it("puts the colon directly after the label, never before the subject (BL-01 sweep M2)", () => {
    const { container } = render(
      <ul>
        <CaveatChip caveat={{ type: "thin-data", message: "m", subject: "Berlin" }} />
      </ul>,
    );
    expect(labels(container)).toEqual(["Thin data:", "Berlin"]);
  });
  it("shows no colon without a subject", () => {
    const { container } = render(
      <ul>
        <CaveatChip caveat={{ type: "no-data", message: "m" }} />
      </ul>,
    );
    expect(labels(container)).toEqual(["No data"]);
  });
});

describe("CaveatList merging (BL-01 M2-06 item 3, M2-03 item 2)", () => {
  const berlin = { type: "thin-data" as const, message: "Berlin has thin data (10 cells).", subject: "Berlin" };
  const leipzig = { type: "thin-data" as const, message: "Leipzig has thin data (3 cells).", subject: "Leipzig" };

  it("merges several thin-data cities into one chip and keeps every sentence", () => {
    const merged = mergeThinData([berlin, { type: "no-data", message: "n" }, leipzig]);
    expect(merged.map((c) => c.type)).toEqual(["thin-data", "no-data"]);
    expect(merged[0]?.subject).toBe("Berlin, Leipzig");
    expect(merged[0]?.message).toBe("Berlin has thin data (10 cells). Leipzig has thin data (3 cells).");
  });

  it("a single thin-data caveat is left alone", () => {
    expect(mergeThinData([berlin])).toEqual([berlin]);
  });

  it("renders one chip for two cities", () => {
    const { container } = render(<CaveatList caveats={[berlin, leipzig]} />);
    expect(container.querySelectorAll(".status")).toHaveLength(1);
    expect(labels(container)).toEqual(["Thin data:", "Berlin, Leipzig"]);
  });
});
