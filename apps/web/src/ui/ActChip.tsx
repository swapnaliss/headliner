import { Icon } from "./Icon";
import { isolate } from "./text";

export interface ActChipProps {
  /** Plain text. Rendered as a text node only. */
  name: string;
  /** "crowd acts" or "candidate acts": names the list for the remove control. */
  listLabel: string;
  onRemove?: () => void;
  /** Hide the remove control while ranking runs. */
  locked?: boolean;
}

/** One typed act in the room form. The chip text is not interactive; the remove control is a button. */
export function ActChip({ name, listLabel, onRemove, locked = false }: ActChipProps) {
  return (
    <li className="act-chip" data-locked={locked ? "true" : undefined}>
      <span className="act-chip-name entity" dir="auto">
        <bdi>{name}</bdi>
      </span>
      {onRemove && !locked ? (
        <button type="button" className="chip-remove" aria-label={`Remove ${isolate(name)} from ${listLabel}`} onClick={onRemove}>
          <Icon name="remove" />
        </button>
      ) : null}
    </li>
  );
}
