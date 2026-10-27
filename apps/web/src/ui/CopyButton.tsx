"use client";

import { useState } from "react";
import { Button } from "./Button";

/**
 * Copies text to the clipboard. The text is already redacted plain text built on the server, so
 * nothing sensitive can reach this component. The outcome is announced in a polite status region.
 */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [message, setMessage] = useState("");
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied.");
    } catch {
      setMessage("Could not copy. Select the text above and copy it.");
    }
  }
  return (
    <span className="copy">
      <Button variant="secondary" onClick={() => void copy()}>
        {label}
      </Button>
      <span role="status" className="field-hint">
        {message}
      </span>
    </span>
  );
}
