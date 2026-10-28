"use client";

import { useRef, type ReactNode } from "react";

/**
 * A native `details` for an Evidence row with one addition: Escape closes it and returns focus to its summary
 * (accessibility.md A-08, ticket: "Escape closes the evidence panel"). Everything else is the browser's own
 * disclosure behaviour, so Enter and Space on the summary still toggle it.
 */
export function EvidenceDetails({ summary, children }: { summary: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className="evidence"
      onKeyDown={(event) => {
        const el = ref.current;
        if (event.key !== "Escape" || !el?.open) return;
        event.preventDefault();
        el.open = false;
        el.querySelector("summary")?.focus();
      }}
    >
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
