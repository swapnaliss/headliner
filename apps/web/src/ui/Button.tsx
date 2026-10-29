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
  /** Associates a submit button that lives outside its `<form>` (the room-setup ActionBar). */
  form?: string;
}

/**
 * Never uses the native `disabled` attribute (components.md): a blocked or busy button is
 * `aria-disabled`, stays focusable, and its click handler is skipped.
 */
export function Button({
  variant = "primary",
  children,
  type = "button",
  onClick,
  loading = false,
  loadingLabel,
  disabled = false,
  describedBy,
  id,
  form,
}: ButtonProps): ReactNode {
  const blocked = disabled || loading;
  return (
    <button
      id={id}
      type={type}
      form={form}
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

export interface ButtonLinkProps {
  variant?: "primary" | "secondary" | "quiet";
  href: string;
  children: string;
  /** Only when the visible text is not enough to tell two links apart; it must start with the visible text (WCAG 2.5.3). */
  ariaLabel?: string;
}

/** A navigation link drawn with the same button hierarchy as `Button` (an `<a>`, never a `<button>`). */
export function ButtonLink({
  variant = "primary",
  href,
  children,
  ariaLabel,
}: ButtonLinkProps): ReactNode {
  return (
    <a className="btn" data-variant={variant} href={href} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
