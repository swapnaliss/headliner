import type { MouseEvent, ReactNode } from "react";
import { Icon } from "./Icon";

export interface ButtonProps {
  variant?: "primary" | "secondary" | "quiet";
  children: string;
  type?: "button" | "submit";
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** In flight: label becomes `loadingLabel`, the button keeps focus and ignores repeat presses. */
  loading?: boolean;
  loadingLabel?: string;
  /** Unavailable because of missing input: stays focusable (no native `disabled`); the reason is linked by id. */
  disabled?: boolean;
  describedBy?: string | undefined;
  id?: string;
}

/**
 * Never uses the native `disabled` attribute (components.md): a blocked or busy button is
 * `aria-disabled`, stays focusable, and its click handler is skipped.
 */
export function Button({ variant = "primary", children, type = "button", onClick, loading = false, loadingLabel, disabled = false, describedBy, id }: ButtonProps): ReactNode {
  const blocked = disabled || loading;
  return (
    <button
      id={id}
      type={type}
      className="btn"
      data-variant={variant}
      aria-disabled={blocked ? "true" : undefined}
      aria-busy={loading ? "true" : undefined}
      aria-describedby={describedBy}
      onClick={(event) => {
        if (blocked) {
          event.preventDefault();
          if (disabled && !loading) onClick?.(event);
          return;
        }
        onClick?.(event);
      }}
    >
      {loading ? <Icon name="spinner" /> : null}
      {loading ? (loadingLabel ?? children) : children}
    </button>
  );
}
