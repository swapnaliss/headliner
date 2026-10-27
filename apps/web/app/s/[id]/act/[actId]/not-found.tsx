"use client";

import { usePathname } from "next/navigation";
import { EmptyState } from "../../../../../src/ui/EmptyState";

/** Unknown act (or slate) on the shared detail route. The same words for every cause, so nothing is revealed. */
export default function SharedActNotFound() {
  const pathname = usePathname();
  const match = /^\/s\/([A-Za-z0-9_-]{21})\/act\//.exec(pathname);
  return (
    <main id="main" tabIndex={-1} className="main shell">
      <EmptyState
        level={1}
        title="This act is not on this slate."
        reason="The link may be wrong, or the slate may have expired. Slates are kept for 30 days."
        action={
          <a className="btn" data-variant="primary" href={match ? `/s/${match[1]}` : "/"}>
            {match ? "Back to the slate" : "Start a new slate"}
          </a>
        }
      />
    </main>
  );
}
