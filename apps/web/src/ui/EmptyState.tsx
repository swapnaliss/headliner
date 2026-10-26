import type { ReactNode } from "react";
import { Icon } from "./Icon";

export interface EmptyStateProps {
  /** Plain text; may contain an entity name. */
  title: string;
  reason: string;
  compact?: boolean;
  /** Heading level: 2 on a page, 3 inside a card. */
  level?: 2 | 3;
  action?: ReactNode;
}

/** An honest "nothing to show": what is missing, why, and the way forward. Never a zero. */
export function EmptyState({ title, reason, compact = false, level, action }: EmptyStateProps) {
  const Heading = (level ?? (compact ? 3 : 2)) === 3 ? "h4" : "h2";
  return (
    <section className="state" data-tone="neutral" data-compact={compact ? "true" : undefined}>
      <div className="state-head">
        <Icon name="unavailable" />
        <Heading className={compact ? "state-title" : undefined} dir="auto">
          <bdi>{title}</bdi>
        </Heading>
      </div>
      <p>{reason}</p>
      {action ? <div className="state-actions">{action}</div> : null}
    </section>
  );
}
