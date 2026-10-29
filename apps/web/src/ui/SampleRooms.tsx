import type { ReactNode } from "react";
import type { SampleLink } from "../samples";
import { ButtonLink } from "./Button";

/** "27 Oct 2026" from a YYYY-MM-DD day, in UTC so the server and browser agree. */
export function formatRecordedOn(day: string): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * "Try a sample room" (M2-06): one feature card per pre-warmed room. Each card has one primary button-link that
 * opens a stored slate, so it makes no Qloo calls and spends no budget. Plain anchors (no prefetch of a page
 * that reads the database). The card itself is not a link: exactly one affordance.
 */
export function SampleRooms({ samples }: { samples: readonly SampleLink[] }): ReactNode {
  if (samples.length === 0) return null;
  return (
    <section id="sample-rooms" className="stack-sm samples" aria-labelledby="samples-heading">
      <h2 id="samples-heading">Try a sample room</h2>
      <p className="field-hint">
        Open a finished slate straight away. These are saved runs: opening one makes no Qloo calls.
      </p>
      <ul className="samples-list">
        {samples.map((s) => (
          <li key={s.slug}>
            <article className="sample-card">
              <h3>
                <span className="sample-venue">{s.venueName}</span>
                <span className="sr-only">, </span>
                <bdi className="entity sample-city">{s.city}</bdi>
              </h3>
              <p className="field-hint">
                Recorded real Qloo run, fetched {formatRecordedOn(s.recordedOn)}.
              </p>
              <ButtonLink href={s.href} ariaLabel={`Open sample slate: ${s.venueName}, ${s.city}`}>
                Open sample slate
              </ButtonLink>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
