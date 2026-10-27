import type { Metadata } from "next";
import { EmptyState } from "../../../src/ui/EmptyState";

export const metadata: Metadata = { title: "Slate not found", robots: { index: false, follow: false } };

/** Unknown, malformed and expired ids all land here with a 404, so the page gives no hint whether the id ever existed. */
export default function SharedSlateNotFound() {
  return (
    <main id="main" tabIndex={-1} className="main shell">
      <EmptyState
        level={1}
        title="This slate is no longer available."
        reason="Slates are kept for 30 days."
        action={
          <a className="btn" data-variant="primary" href="/">
            Start a new slate
          </a>
        }
      />
    </main>
  );
}
