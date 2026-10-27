"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { TextField } from "./TextField";

/**
 * The share link and its Copy link control (docs/design/screen-slate.md). `path` is built by the app
 * from the random slate id (never from typed text); the absolute address is completed in the browser.
 * The outcome is announced in a polite status region and cleared after 4 seconds.
 */
export function ShareLink({ path }: { path: string }) {
  const [url, setUrl] = useState(path);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setUrl(new URL(path, window.location.origin).toString());
    return () => clearTimeout(timer.current);
  }, [path]);

  function announce(text: string): void {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 4000);
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      announce("Link copied.");
    } catch {
      input.current?.focus();
      input.current?.select();
      announce("Copy failed. The link is selected; press Ctrl+C.");
    }
  }

  return (
    <div className="share-link">
      <TextField id="share-url" label="Link to this slate" value={url} readOnly inputRef={input} />
      <Button variant="secondary" onClick={() => void copy()}>
        Copy link
      </Button>
      <p role="status" className="field-hint share-status">
        {message}
      </p>
    </div>
  );
}
