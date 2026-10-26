import type { ReactNode, Ref } from "react";
import { Icon } from "./Icon";

export interface ErrorStateProps {
  title: string;
  /** A fixed, generic message. Never raw upstream text, a stack trace or an endpoint body. */
  message: string;
  /** What still works or was kept. */
  kept?: string;
  actions?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  /** "alert" when the error replaces expected content; "status" for a non-blocking failure. */
  role?: "alert" | "status";
}

/** A failed run or load: what failed, what was kept, the way forward. */
export function ErrorState({ title, message, kept, actions, headingRef, role = "alert" }: ErrorStateProps) {
  return (
    <section className="state" data-tone="error" role={role}>
      <div className="state-head">
        <Icon name="error" />
        <h2 ref={headingRef} tabIndex={-1}>
          {title}
        </h2>
      </div>
      <p>{message}</p>
      {kept ? <p>{kept}</p> : null}
      {actions ? <div className="state-actions">{actions}</div> : null}
    </section>
  );
}
