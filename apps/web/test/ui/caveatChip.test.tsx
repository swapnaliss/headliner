// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CaveatChip } from "../../src/ui/CaveatChip";

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
