import { THIN_DATA_CELLS } from "@headliner/core";
import { Icon } from "./Icon";
import { plural } from "./text";

/**
 * "Thin data": fewer than 15 Qloo heatmap cells back a city's mean affinity rank (ADR 0013).
 * Icon plus text, never colour alone; the block variant adds the full sentence (components.md).
 */
export function ThinDataBadge({ cellCount, variant = "inline" }: { cellCount: number; variant?: "inline" | "block" }) {
  return (
    <span className="thin-badge">
      <span className="status" data-tone="caution">
        <Icon name="thin" />
        <span>Thin data</span>
        <span className="sr-only">
          , {cellCount} {plural(cellCount, "cell", "cells")}
        </span>
      </span>
      {variant === "block" ? (
        <span className="field-hint">
          Thin data: only {cellCount} Qloo heatmap {plural(cellCount, "cell", "cells")} for this city (fewer than {THIN_DATA_CELLS}). The mean affinity rank may not be representative.
        </span>
      ) : null}
    </span>
  );
}
