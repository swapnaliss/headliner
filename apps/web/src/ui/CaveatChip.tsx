import type { Caveat } from "@headliner/core";
import { Icon, type IconName } from "./Icon";

const LABELS: Record<Caveat["type"], { label: string; icon: IconName; tone: "caution" | "neutral" | "info" }> = {
  "thin-data": { label: "Thin data", icon: "thin", tone: "caution" },
  "no-data": { label: "No data", icon: "unavailable", tone: "neutral" },
  "low-match-confidence": { label: "Match chosen by you", icon: "info", tone: "info" },
  "standing-unavailable": { label: "Popularity rank unavailable", icon: "unavailable", tone: "neutral" },
  "single-tag-overlap": { label: "Fit unavailable", icon: "unavailable", tone: "neutral" },
};

/**
 * A short flag explaining a limit on the number beside it: icon plus text, never colour alone.
 * The sentence from core (`message`) is shown in full under the label; `subject` is untrusted
 * text and is only ever a text node.
 */
export function CaveatChip({ caveat }: { caveat: Caveat }) {
  const meta = LABELS[caveat.type];
  return (
    <li className="stack-sm">
      <span className="status" data-tone={meta.tone}>
        <Icon name={meta.icon} />
        <span>{meta.label}</span>
        {caveat.subject ? (
          <span>
            : <bdi className="entity">{caveat.subject}</bdi>
          </span>
        ) : null}
      </span>
      <span className="field-hint">{caveat.message}</span>
    </li>
  );
}

export function CaveatList({ caveats }: { caveats: readonly Caveat[] }) {
  if (caveats.length === 0) return null;
  return (
    <ul className="stack-sm" aria-label="Caveats">
      {caveats.map((caveat, i) => (
        <CaveatChip key={`${caveat.type}-${caveat.subject ?? ""}-${i}`} caveat={caveat} />
      ))}
    </ul>
  );
}
