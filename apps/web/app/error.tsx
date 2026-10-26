"use client";

import { useEffect, useRef } from "react";
import { Button } from "../src/ui/Button";
import { ErrorState } from "../src/ui/ErrorState";

/** Route-level failure: a fixed generic message, never the raw error text. */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <main id="main" className="main shell">
      <ErrorState
        title="This page could not be loaded"
        message="Something went wrong on our side. Nothing you entered was lost; try again in a moment."
        headingRef={heading}
        actions={
          <>
            <Button variant="secondary" onClick={reset}>
              Try again
            </Button>
            <a className="btn" data-variant="quiet" href="/">
              Back to edit the room
            </a>
          </>
        }
      />
    </main>
  );
}
