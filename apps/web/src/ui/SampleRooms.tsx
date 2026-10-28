import type { ReactNode } from "react";
import type { SampleLink } from "../samples";

/** "27 Oct 2026" from a YYYY-MM-DD day, in UTC so the server and browser agree. */
export function formatRecordedOn(day: string): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

/**
 * "Try a sample room" (M2-06): one link per pre-warmed room. Each opens a stored slate, so it makes
 * no Qloo calls and spends no budget. Links are styled as secondary buttons and are plain anchors
 * (no prefetch of a page that reads the database).
 */
export function SampleRooms({ samples }: { samples: readonly SampleLink[] }): ReactNode {
  if (samples.length === 0) return null;
  return (
    <section id="sample-rooms" className="stack-sm samples" aria-labelledby="samples-heading">
      <h2 id="samples-heading">Try a sample room</h2>
      <p className="field-hint">Open a finished slate straight away. These are saved runs: opening one makes no Qloo calls.</p>
      <ul className="samples-list">
        {samples.map((s) => (
          <li key={s.slug}>
            <a className="btn" data-variant="secondary" href={s.href}>
              {s.venueName}, {s.city}
            </a>
            <span className="field-hint">Recorded real Qloo run, fetched {formatRecordedOn(s.recordedOn)}.</span>
          </li>
        ))}
      </ul>
      <p className="field-hint samples-or">Or enter your own room below.</p>
    </section>
  );
}
