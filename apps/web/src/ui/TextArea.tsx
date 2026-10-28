import type { ChangeEvent, Ref } from "react";
import { Icon } from "./Icon";

export interface TextAreaProps {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  value: string;
  onChange?: (value: string) => void;
  maxLength?: number;
  rows?: number;
  readOnly?: boolean;
  inputRef?: Ref<HTMLTextAreaElement>;
  /** Extra describedby id (for example a character count). */
  describedBy?: string | undefined;
}

/** A multi-line TextField: label, hint, field, error, all linked by id. Read-only while busy, never `disabled`. */
export function TextArea({ id, label, hint, error, value, onChange, maxLength, rows = 3, readOnly, inputRef, describedBy }: TextAreaProps) {
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
      <textarea
        id={id}
        ref={inputRef}
        className="input"
        rows={rows}
        dir="auto"
        autoComplete="off"
        autoCapitalize="sentences"
        value={value}
        maxLength={maxLength}
        readOnly={readOnly}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={described}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value)}
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
