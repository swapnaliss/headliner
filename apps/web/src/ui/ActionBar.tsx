import { Button } from "./Button";

export interface ActionBarProps {
  busy: boolean;
  /** Any entry made yet (a city, an act, or text in an add field). Below 1024px the bar only sticks once this is true. */
  started: boolean;
  /** The first unmet requirement, or null when the room can be ranked. */
  reason: string | null;
  /** Activating the button while it is blocked by a missing entry (validation moves focus and announces the reason). */
  onBlockedPress: () => void;
}

/**
 * The room-setup primary action with its reason, kept in view (components.md, ActionBar). The button is a submit
 * button associated with the form by `form="room-form"`, so this block can live outside the form element: a bar at the
 * bottom of the viewport below 1024px, the first card of the aside from 1024px. It is the only "Rank these acts" button.
 */
export function ActionBar({ busy, started, reason, onBlockedPress }: ActionBarProps) {
  return (
    <section className="action-bar" aria-label="Rank these acts" data-started={started ? "true" : "false"}>
      <Button
        id="rank-button"
        type="submit"
        form="room-form"
        loading={busy}
        loadingLabel="Ranking…"
        disabled={reason !== null}
        describedBy={reason ? "rank-reason" : undefined}
        onClick={() => {
          if (reason !== null) onBlockedPress();
        }}
      >
        Rank these acts
      </Button>
      {reason ? (
        <p className="field-hint" id="rank-reason">
          {reason}
        </p>
      ) : null}
    </section>
  );
}
