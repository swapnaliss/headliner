// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import NotFound from "../../app/not-found";

afterEach(cleanup);

describe("not-found page (BL-01 sweep M1)", () => {
  it("has exactly one heading, an h1 carrying the spec title", () => {
    render(<NotFound />);
    const headings = screen.getAllByRole("heading");
    expect(headings).toHaveLength(1);
    expect(headings[0]?.tagName).toBe("H1");
    expect(headings[0]?.textContent).toBe("This slate is no longer available.");
  });
});
