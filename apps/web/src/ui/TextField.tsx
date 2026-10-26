import type { ChangeEvent, ClipboardEvent, KeyboardEvent, Ref } from "react";
import { Icon } from "./Icon";

export interface TextFieldProps {
  id: string;
  label: string;
  hint?: string | undefined;
  /** Specific message: what is wrong and how to fix it. */
  error?: string | undefined;
  value: string;
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLInputElement>) => void;
  maxLength?: number;
  required?: boolean;
  readOnly?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  /** Extra describedby id (for example a limit message). */
  describedBy?: string | undefined;
}

/**
 * Label above, hint, input, error. Hint and error are linked with `aria-describedby`; an invalid
 * field sets `aria-invalid`. Read-only is used instead of `disabled`. Autofill is off: act and
 * city names are not personal data.
 */
export function TextField({ id, label, hint, error, value, onChange, onKeyDown, onPaste, maxLength, required, readOnly, inputRef, describedBy }: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const described = [hintId, errorId, describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        ref={inputRef}
        className="input"
        type="text"
        dir="auto"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={value}
        maxLength={maxLength}
        required={required}
        readOnly={readOnly}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={described}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
      {error ? (
        <p className="field-error" id={errorId}>
          <Icon name="error" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
