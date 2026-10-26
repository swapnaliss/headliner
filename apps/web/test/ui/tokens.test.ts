import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../../..");
const spec = readFileSync(resolve(root, "docs/design/design-system.md"), "utf8");
const css = readFileSync(resolve(root, "apps/web/app/tokens.css"), "utf8");

function specBlock(): string {
  const section = spec.split("## 9. The single CSS token block")[1] ?? "";
  const match = /```css\n([\s\S]*?)```/.exec(section);
  if (!match?.[1]) throw new Error("token block not found");
  return match[1];
}

describe("tokens.css matches docs/design/design-system.md (accessibility C-02)", () => {
  it("is the single token block from section 9", () => {
    expect(css.endsWith(specBlock())).toBe(true);
  });

  it("every colour in the token reference table equals the light-dark() pair in the CSS", () => {
    const rows = [...spec.matchAll(/^\| (`--[a-z-]+`(?: \/ `--[a-z-]+`)*) \| (`#[0-9A-Fa-f]{6}`(?: \/ `#[0-9A-Fa-f]{6}`)*) \| (`#[0-9A-Fa-f]{6}`(?: \/ `#[0-9A-Fa-f]{6}`)*) \|/gm)];
    expect(rows.length).toBeGreaterThan(15);
    let checked = 0;
    for (const row of rows) {
      const names = (row[1] ?? "").match(/--[a-z-]+/g) ?? [];
      const light = (row[2] ?? "").match(/#[0-9A-Fa-f]{6}/g) ?? [];
      const dark = (row[3] ?? "").match(/#[0-9A-Fa-f]{6}/g) ?? [];
      names.forEach((name, i) => {
        const re = new RegExp(`${name}: light-dark\\((#[0-9A-Fa-f]{6}), (#[0-9A-Fa-f]{6})\\)`);
        const m = re.exec(css);
        expect(m, name).not.toBeNull();
        expect(m?.[1]?.toLowerCase(), `${name} light`).toBe(light[i]?.toLowerCase());
        expect(m?.[2]?.toLowerCase(), `${name} dark`).toBe(dark[i]?.toLowerCase());
        checked++;
      });
    }
    expect(checked).toBeGreaterThanOrEqual(26);
  });
});
