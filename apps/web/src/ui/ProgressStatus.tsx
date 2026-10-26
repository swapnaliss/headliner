export interface ProgressStatusProps {
  /** The sentence announced politely, for example "Ranking 4 acts. This can take up to 40 seconds the first time." */
  message: string;
  /** Optional determinate progress. */
  value?: number;
  max?: number;
  slowNotice?: string | undefined;
}

/** One polite live region plus a visible progress bar. The region exists before its text changes. */
export function ProgressStatus({ message, value, max, slowNotice }: ProgressStatusProps) {
  return (
    <div className="stack-sm">
      <div role="status" aria-live="polite">
        <p>{message}</p>
        {slowNotice ? <p>{slowNotice}</p> : null}
      </div>
      {value !== undefined && max !== undefined ? <progress value={value} max={max} aria-label={message} /> : null}
    </div>
  );
}
