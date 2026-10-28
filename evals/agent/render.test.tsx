// "Rendered text escapes it" (ticket M3-03): every injection string and every hostile act name, put into a Slate and
// explained, is rendered by the REAL Explanation component and must come out as escaped text, never as markup.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { explainSlate } from "../../packages/agent/src/index";
import { loadSlate, withActName } from "../../packages/agent/src/explain/testkit";
import { Explanation } from "../../apps/web/src/ui/Explanation";
import { injectionString, loadAdversarial, loadInjections } from "./common";

const names = [
  ...loadInjections().cases.map((c) => ({ id: c.id, value: injectionString(c) })),
  ...loadAdversarial().cases.flatMap((c) => (c.kind === "hostile_slate" ? [{ id: c.id, value: c.actName }] : [])),
];

describe("the Explanation component renders third-party text as plain text", () => {
  it.each(names)("$id", async ({ value }) => {
    const slate = withActName(loadSlate("sample-leipzig-indie"), 0, value);
    const result = await explainSlate(slate, {});
    const html = renderToStaticMarkup(<Explanation text={result.text} source={result.source} />);
    // No element from the string exists: a tag it carries can only appear escaped.
    expect(html).not.toMatch(/<(?:script|img|iframe|a|svg|style)[\s>/]/i);
    if (value.includes("<")) expect(html).toContain("&lt;");
    if (value.includes("&")) expect(html).toContain("&amp;");
    // Markdown is not interpreted: no link or emphasis element is produced.
    expect(html).not.toMatch(/<(?:a|strong|em)[\s>]/i);
    // The component is the only thing that makes elements: one section, a heading, the label and the text lines.
    expect(html.startsWith("<section")).toBe(true);
  });
});
