import type { ActResult, Evidence } from "@headliner/core";
import { CaveatList } from "./CaveatChip";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { COPY, isolate, plural } from "./text";

const STANDING_LABELS = {
  above: "Above crowd median",
  similar: "Similar to crowd median",
  below: "Below crowd median",
} as const;

const STANDING_WORD = {
  above: "above",
  similar: "similar to",
  below: "below",
} as const;

function fmt(value: number, digits: number): string {
  return value.toFixed(digits);
}

/** Caption, glyph (a dot against a median line, never an arrow), label and the two values. Neutral colours. */
export function StandingLine({ standing }: { standing: NonNullable<ActResult["standing"]> }) {
  const label = STANDING_LABELS[standing.label];
  const candidate = fmt(standing.candidatePercentile, 1);
  const median = fmt(standing.crowdMedianPercentile, 1);
  return (
    <div
      className="standing"
      role="group"
      aria-label={`${COPY.standingCaption}: ${STANDING_WORD[standing.label]} the crowd median, ${candidate} out of 100 compared with a median of ${median}. Higher means better known on Qloo.`}
    >
      <p className="standing-caption">{COPY.standingCaption}</p>
      <p>
        <span className="status" data-tone="neutral">
          <Icon name={standing.label} />
          <span>{label}</span>
        </span>
      </p>
      <p className="num">
        {candidate} of 100 vs crowd median {median}
      </p>
      <p className="standing-note">{COPY.standingScale}</p>
    </div>
  );
}

/** The recorded Qloo calls behind the numbers on a card: redacted request summaries only, never headers or keys. */
export function EvidenceDisclosure({ name, evidence }: { name: string; evidence: readonly Evidence[] }) {
  const count = evidence.length;
  return (
    <details className="evidence">
      <summary aria-label={`Evidence for ${isolate(name)}, ${count} ${plural(count, "call", "calls")}`}>
        Evidence ({count} {plural(count, "call", "calls")})
      </summary>
      <ol aria-label="Evidence trail">
        {evidence.map((ev) => (
          <li key={ev.id} id={`${ev.id}`}>
            <span className="mono">{ev.endpoint}</span>
            <span className="mono">
              {Object.entries(ev.redactedParams)
                .map(([k, v]) => `${k}=${v}`)
                .join("\n")}
            </span>
            <span>
              Response digest <span className="mono">{ev.responseDigest.slice(0, 12)}</span>
            </span>
            <span>
              Fetched <time dateTime={ev.fetchedAt}>{ev.fetchedAt}</time>
            </span>
          </li>
        ))}
      </ol>
      <p className="field-hint">Request headers, including the API key, are never stored or shown.</p>
    </details>
  );
}

export interface ActCardProps {
  result: ActResult;
  /** Total ranked acts, for "Rank 2 of 3". */
  rankedCount: number;
  tiedWithPrevious?: boolean;
}

/** One candidate act on the slate: `<li><article>`; the act name is plain text in an `<h3>`. */
export function ActCard({ result, rankedCount, tiedWithPrevious = false }: ActCardProps) {
  const { act } = result;
  const headingId = `act-${act.qlooEntityId.replace(/[^A-Za-z0-9_-]/g, "_")}-name`;
  const noData = result.status === "no-data" || result.fit === null;
  const reason = "Qloo returned nothing usable for this act, so no Fit or Qloo popularity rank is shown.";
  const shown = result.overlapTags.slice(0, 3);
  return (
    <li>
      <article className="act-card" aria-labelledby={headingId}>
        <div className="card-head">
          {result.rank !== null ? (
            <span className="rank" aria-label={`Rank ${result.rank} of ${rankedCount}`}>
              {result.rank}
            </span>
          ) : (
            <span className="rank" data-unranked="true">
              Not ranked
            </span>
          )}
          <h3 id={headingId} className="act-name" dir="auto">
            <bdi>{act.name}</bdi>
          </h3>
        </div>

        {noData ? (
          <EmptyState compact title={`No data for ${act.name}`} reason={reason} />
        ) : (
          <div className="card-body">
            <div className="stack-sm">
              <div className="fit">
                <span className="sr-only">{`Audience-taste fit ${fmt(result.fit?.value ?? 0, 1)} out of 100`}</span>
                <span className="fit-label" aria-hidden="true">
                  Fit
                </span>
                <span className="fit-value" aria-hidden="true">
                  {fmt(result.fit?.value ?? 0, 1)}
                </span>
              </div>
              {tiedWithPrevious ? <p className="field-hint">Same Fit as the act above; ordered by name.</p> : null}
              {shown.length > 0 ? (
                <ul className="chip-row" aria-label="Top shared tastes">
                  {shown.map((tag) => (
                    <li key={tag.tagId} className="tag-chip">
                      <bdi className="entity" dir="auto">
                        {tag.name}
                      </bdi>
                    </li>
                  ))}
                </ul>
              ) : null}
              {result.overlapTags.length > 0 ? (
                <p className="field-hint">
                  {result.overlapTags.length} shared {plural(result.overlapTags.length, "taste", "tastes")} with your crowd
                </p>
              ) : null}
            </div>
            <div className="stack-sm">
              {result.standing ? (
                <StandingLine standing={result.standing} />
              ) : (
                <div className="standing">
                  <p className="standing-caption">{COPY.standingCaption}</p>
                  <p>
                    <span className="status" data-tone="neutral">
                      <Icon name="unavailable" />
                      <span>Unavailable</span>
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <CaveatList caveats={result.caveats} />
        {result.evidence.length > 0 ? <EvidenceDisclosure name={act.name} evidence={result.evidence} /> : null}
      </article>
    </li>
  );
}
