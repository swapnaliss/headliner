import { describe, expect, it } from "vitest";
import { FIT_CLOSE_SPREAD_POINTS, fitSpread, fitValuesAreClose, popularityPositions, STANDING_SIMILAR_BAND_POINTS } from "../src";
import { actResult } from "./helpers";

describe("fit spread and popularity positions", () => {
  it("constants match ADR 0013", () => {
    expect(FIT_CLOSE_SPREAD_POINTS).toBe(5);
    expect(STANDING_SIMILAR_BAND_POINTS).toBe(5);
  });

  it("spread is best minus worst scored Fit, one decimal (recorded sample 2.5)", () => {
    const rs = [actResult("a", "Reality Club", 60.6), actResult("b", "Radiohead", 59.5), actResult("c", "Khruangbin", 58.1), actResult("d", "Hindia", null)];
    expect(fitSpread(rs)).toBe(2.5);
    expect(fitValuesAreClose(rs)).toBe(true);
  });

  it("is null with fewer than two scored acts and never close then", () => {
    expect(fitSpread([actResult("a", "A", 50)])).toBeNull();
    expect(fitSpread([])).toBeNull();
    expect(fitValuesAreClose([actResult("a", "A", 50)])).toBe(false);
  });

  it("exactly 5 points is not close; 4.9 is", () => {
    expect(fitValuesAreClose([actResult("a", "A", 60), actResult("b", "B", 55)])).toBe(false);
    expect(fitValuesAreClose([actResult("a", "A", 60), actResult("b", "B", 55.1)])).toBe(true);
  });

  it("popularity positions rank by percentile, ties by name, and skip acts without standing", () => {
    const rs = [actResult("a", "Reality Club", 60.6, 86.4), actResult("b", "Radiohead", 59.5, 100), actResult("c", "Khruangbin", 58.1, 99.2), actResult("d", "Hindia", null)];
    const pos = popularityPositions(rs);
    expect(pos.get("a")).toBe(3);
    expect(pos.get("b")).toBe(1);
    expect(pos.get("c")).toBe(2);
    expect(pos.has("d")).toBe(false);
    const tie = popularityPositions([actResult("x", "Zed", 1, 50), actResult("y", "Abe", 1, 50)]);
    expect(tie.get("y")).toBe(1);
  });
});
