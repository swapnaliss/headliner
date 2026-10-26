"use client";

import { usePathname } from "next/navigation";
import { EmptyState } from "../../../../../src/ui/EmptyState";

/** Unknown act (or slate) on the detail route: the 404 page offers the way back to the slate. */
export default function ActNotFound() {
  const pathname = usePathname();
  const match = /^\/slates\/([A-Za-z0-9_-]{21})\/act\//.exec(pathname);
  return (
    <main id="main" tabIndex={-1} className="main shell">
      <EmptyState
        level={1}
        title="This act is not on this slate."
        reason="The link may be wrong, or the slate may have expired. Slates are kept for 30 days."
        action={
          <a className="btn" data-variant="primary" href={match ? `/slates/${match[1]}` : "/"}>
            {match ? "Back to the slate" : "Start a new slate"}
          </a>
        }
      />
    </main>
  );
}
