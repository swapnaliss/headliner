import type { MatchCandidate } from "@headliner/core";
import { Icon } from "./Icon";

export interface MatchPickerProps {
  /** Id of the legend: the focus target when ranking is attempted too early. */
  id: string;
  /** Plain text. */
  typedName: string;
  /** Plain text throughout; names, tags and descriptors come from Qloo and are untrusted. */
  hits: readonly MatchCandidate[];
  /** Selected entity id, "skip" for "None of these", or null while nothing is chosen. */
  value: string | null;
  locked?: boolean;
  onChange: (value: string) => void;
}

/** "Qloo popularity rank 83.1 of 100": the popularity score x 100, one decimal. */
export function popularityText(popularity: number | null): string {
  if (popularity === null) return "Qloo popularity rank unavailable for this match";
  return `Qloo popularity rank ${(popularity * 100).toFixed(1)} of 100 (higher is better known on Qloo)`;
}

/**
 * One typed name, several Qloo hits: a single-choice group with nothing preselected. Each option
 * shows name, three tags and the popularity rank so same-named artists can be told apart.
 */
export function MatchPicker({ id, typedName, hits, value, locked = false, onChange }: MatchPickerProps) {
  const group = `${id}-group`;
  return (
    <fieldset className="match-picker" aria-describedby={`${id}-hint`}>
      <legend id={id} tabIndex={-1}>
        Which <bdi className="entity" dir="auto">{typedName}</bdi>?
      </legend>
      <p>
        You typed: <bdi className="entity" dir="auto">{typedName}</bdi>
      </p>
      <p id={`${id}-hint`} className="field-hint">
        Choose one match. Choosing none of these leaves the act out.
      </p>
      <div className="match-options">
        {hits.map((hit) => {
          const optionId = `${group}-${hit.entityId}`;
          const selected = value === hit.entityId;
          return (
            <label key={hit.entityId} htmlFor={optionId} className="match-option" data-selected={selected ? "true" : undefined}>
              <input type="radio" id={optionId} name={group} value={hit.entityId} checked={selected} readOnly={locked} onChange={() => (locked ? undefined : onChange(hit.entityId))} />
              <span className="match-option-body">
                <span className="match-option-name entity" dir="auto">
                  <bdi>{hit.name}</bdi>
                </span>
                <span className="match-meta">Artist</span>
                {hit.tags.length > 0 ? <span className="match-meta">{`Tags: ${hit.tags.join(", ")}`}</span> : null}
                {hit.disambiguation && hit.disambiguation.trim().toLowerCase() !== hit.name.trim().toLowerCase() ? (
                  <span className="match-meta">
                    <bdi dir="auto">{hit.disambiguation}</bdi>
                  </span>
                ) : hit.tags.length === 0 ? (
                  <span className="match-meta">No description from Qloo</span>
                ) : null}
                <span className="match-meta">{popularityText(hit.popularity)}</span>
              </span>
              {selected ? (
                <span className="match-selected">
                  <Icon name="check" /> Selected
                </span>
              ) : null}
            </label>
          );
        })}
        <label htmlFor={`${group}-none`} className="match-option match-none" data-selected={value === "skip" ? "true" : undefined}>
          <input type="radio" id={`${group}-none`} name={group} value="skip" checked={value === "skip"} readOnly={locked} onChange={() => (locked ? undefined : onChange("skip"))} />
          <span className="match-option-body">
            <span className="match-option-name">None of these</span>
          </span>
          {value === "skip" ? (
            <span className="match-selected">
              <Icon name="check" /> Selected
            </span>
          ) : null}
        </label>
      </div>
    </fieldset>
  );
}
