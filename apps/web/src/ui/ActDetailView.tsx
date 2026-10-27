import { evidenceRequestText } from "@headliner/qloo";
import type { ActDetail, DetailEvidence } from "../actDetail";
import { CopyButton } from "./CopyButton";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { SharedTastes } from "./SharedTastes";
import { COPY, isolate, plural } from "./text";

const STANDING_LABELS = {
  above: "Above crowd median",
  similar: "Similar to crowd median",
  below: "Below crowd median",
} as const;

const COUNT_WORD: Record<number, string> = { 1: "one", 2: "two", 3: "three" };

const NO_DATA_REASON = "Qloo returned nothing usable for it, so no Fit or Qloo popularity rank is shown.";

function EvidenceLinks({ indexes }: { indexes: readonly number[] }) {
  return (
    <p className="field-hint">
      See evidence:{" "}
      {indexes.map((n, i) => (
        <span key={n}>
          {i > 0 ? ", " : ""}
          <a href={`#ev-${n}`} aria-label={`Evidence ${n}`}>
            {n}
          </a>
        </span>
      ))}
    </p>
  );
}

function FitTile({ detail }: { detail: ActDetail }) {
  const { fit } = detail;
  return (
    <div className="panel">
      <h2 id="fit-tile" className="tile-title">
        Fit
      </h2>
      {fit ? (
        <>
          <p className="fit-value-lg num" data-testid="fit-value">
            {fit.value.toFixed(1)}
          </p>
          <p className="field-hint">Audience-taste fit, 0 to 100.</p>
          <EvidenceLinks indexes={fit.evidenceIndexes} />
          {detail.closeSpread !== null ? (
            <p className="field-hint">
              On this slate Fit values span {detail.closeSpread.toFixed(1)} points, so neighbouring ranks are close. Derived from the Fit values on the slate.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p>
            <span className="status" data-tone="neutral">
              <Icon name="unavailable" />
              <span>Fit unavailable</span>
            </span>
          </p>
          <p>{detail.fitUnavailableReason}</p>
        </>
      )}
    </div>
  );
}

function StandingTile({ detail }: { detail: ActDetail }) {
  const s = detail.standing;
  return (
    <div className="panel">
      <h2 id="standing-tile" className="tile-title">
        {COPY.standingCaption}
      </h2>
      {s ? (
        <>
          <p>
            <span className="status" data-tone="neutral">
              <Icon name={s.label} />
              <span>{STANDING_LABELS[s.label]}</span>
            </span>
          </p>
          <p className="num">
            {s.candidatePercentile.toFixed(1)} of 100 vs crowd median {s.crowdMedianPercentile.toFixed(1)}
          </p>
          <p className="field-hint">{COPY.standingScale}</p>
          <EvidenceLinks indexes={s.evidenceIndexes} />
        </>
      ) : (
        <>
          <p>
            <span className="status" data-tone="neutral">
              <Icon name="unavailable" />
              <span>Unavailable</span>
            </span>
          </p>
          <p>
            {detail.status === "no-data"
              ? "No Qloo popularity rank is shown because Qloo returned nothing usable for this act."
              : "Qloo gave no popularity value for this act or for your crowd acts."}
          </p>
        </>
      )}
    </div>
  );
}

function CaveatsTile({ detail }: { detail: ActDetail }) {
  return (
    <div className="panel">
      <h2 id="caveats-tile" className="tile-title">
        Caveats
      </h2>
      {detail.caveats.length === 0 ? (
        <p>No caveats recorded for this act.</p>
      ) : (
        <ul className="stack-sm" aria-label="Caveats">
          {detail.caveats.map((c, i) => (
            <li key={`${c.code}-${c.subject ?? ""}-${i}`} className="stack-sm" data-caveat={c.code}>
              <span className="status" data-tone={c.code === "thin_city_data" ? "caution" : c.code === "low_match_confidence" ? "info" : "neutral"}>
                <Icon name={c.code === "thin_city_data" ? "thin" : c.code === "low_match_confidence" ? "info" : "unavailable"} />
                <span>{CAVEAT_LABEL[c.code]}</span>
                {c.subject ? (
                  <span>
                    : <bdi className="entity">{c.subject}</bdi>
                  </span>
                ) : null}
              </span>
              <span className="field-hint">{c.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CAVEAT_LABEL = {
  no_data: "No data",
  low_match_confidence: "Match chosen by you",
  thin_city_data: "Thin data",
  standing_not_capacity: "Standing, not room size",
} as const;

function WhyFit({ detail }: { detail: ActDetail }) {
  const { whyFit } = detail;
  const name = detail.act.name;
  if (!whyFit) {
    return (
      <section className="stack-sm" aria-labelledby="why-heading">
        <h2 id="why-heading">Why Fit is unavailable</h2>
        <p className="lead">{detail.fitUnavailableReason}</p>
      </section>
    );
  }
  const [a, b, c] = whyFit.topTags;
  const top = whyFit.topTags.length >= 3 ? (
    <>
      <bdi className="entity">{a}</bdi>, <bdi className="entity">{b}</bdi> and <bdi className="entity">{c}</bdi>
    </>
  ) : (
    whyFit.topTags.map((t, i) => (
      <span key={t}>
        {i > 0 ? ", " : ""}
        <bdi className="entity">{t}</bdi>
      </span>
    ))
  );
  return (
    <section className="stack-sm" aria-labelledby="why-heading">
      <h2 id="why-heading">Why this Fit</h2>
      <p className="lead">
        <bdi className="entity">{name}</bdi> shares {whyFit.sharedTags} {plural(whyFit.sharedTags, "tag", "tags")} with your crowd. The {COUNT_WORD[whyFit.topTags.length] ?? "top"} with the highest Qloo{" "}
        {plural(whyFit.topTags.length, "score is", "scores are")} {top}. Fit is the mean of the Qloo scores of those shared tags. Do not read a difference of a point or two as meaningful.
      </p>
    </section>
  );
}

function StandingSection({ detail }: { detail: ActDetail }) {
  const e = detail.standingExplanation;
  if (!detail.standing) return null;
  return (
    <section className="stack-sm" aria-labelledby="standing-heading">
      <h2 id="standing-heading">{COPY.standingCaption}</h2>
      <p className="num">
        {detail.standing.candidatePercentile.toFixed(1)} of 100 vs crowd median {detail.standing.crowdMedianPercentile.toFixed(1)}
      </p>
      <p className="lead">
        Compared with the median of {detail.standing.crowdSample} crowd {plural(detail.standing.crowdSample, "act", "acts")} that {plural(detail.standing.crowdSample, "has", "have")} a Qloo popularity value. This is a standing on Qloo (0 to 100, higher is better known), not a measure of change over time or room size.
      </p>
      {e ? (
        <p className="field-hint">
          The act&apos;s own value comes from <a href={`#ev-${e.candidateEvidenceIndex}`}>evidence {e.candidateEvidenceIndex}</a>; the crowd values come from{" "}
          {e.crowdEvidenceIndexes.map((n, i) => (
            <span key={n}>
              {i > 0 ? ", " : ""}
              <a href={`#ev-${n}`}>evidence {n}</a>
            </span>
          ))}
          .
        </p>
      ) : null}
      <p className="field-hint">Similar means within 5 percentile points of the crowd median (exactly 5 is similar).</p>
    </section>
  );
}

/** "2026-10-26T12:33:32.533Z" -> "2026-10-26 12:33 +00:00" (UTC). Falls back to the stored text. */
function fetchedLabel(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? `${m[1]} ${m[2]} +00:00` : iso;
}

function EvidenceRow({ ev }: { ev: DetailEvidence }) {
  const text = evidenceRequestText(ev);
  return (
    <tr id={`ev-${ev.index}`} tabIndex={-1} className="ev-row">
      <th scope="row" data-label="Evidence">
        {ev.index}
        <span className="sr-only"> of the evidence trail</span>
        <span className="linked-note">Linked from above</span>
      </th>
      <td data-label="Endpoint" className="mono">
        GET {ev.endpoint}
      </td>
      <td data-label="Fetched">
        <time dateTime={ev.fetchedAt}>{fetchedLabel(ev.fetchedAt)}</time>
        {ev.status === "ok" ? null : <span> (Failed)</span>}
      </td>
      <td data-label="Supports">{ev.supports.length > 0 ? ev.supports.join(", ") : "Context only"}</td>
      <td data-label="Parameters (redacted) and response digest">
        <details className="evidence">
          <summary>Show parameters and digest</summary>
          <div className="stack-sm">
            <pre className="mono ev-text" tabIndex={0} aria-label={`Evidence ${ev.index} request, redacted`}>
              {text}
            </pre>
            <CopyButton text={text} label={`Copy request ${ev.index}`} />
          </div>
        </details>
      </td>
    </tr>
  );
}

function EvidenceTrail({ evidence }: { evidence: readonly DetailEvidence[] }) {
  const n = evidence.length;
  return (
    <section id="evidence" tabIndex={-1} className="stack-sm" aria-labelledby="evidence-heading">
      <h2 id="evidence-heading">
        Evidence trail ({n} {plural(n, "call", "calls")})
      </h2>
      <p className="lead">Each number on this page comes from the Qloo calls below. Parameters are redacted summaries.</p>
      {n === 0 ? (
        <p>No Qloo call produced usable data for this act.</p>
      ) : (
        <table className="ev-table">
          <caption className="sr-only">Qloo calls behind the numbers on this page</caption>
          <thead>
            <tr>
              <th scope="col">Evidence</th>
              <th scope="col">Endpoint</th>
              <th scope="col">Fetched</th>
              <th scope="col">Supports</th>
              <th scope="col">Parameters (redacted) and response digest</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((ev) => (
              <EvidenceRow key={ev.index} ev={ev} />
            ))}
          </tbody>
        </table>
      )}
      <p className="field-hint">Request headers, including the API key, are never stored or shown.</p>
    </section>
  );
}

/** The act detail screen (docs/design/screen-act-detail.md). Server component: every value is already in `detail`. */
export function ActDetailView({ detail }: { detail: ActDetail }) {
  const slateHref = `/slates/${detail.slateId}`;
  const { act } = detail;
  const href = (entityId: string): string => `${slateHref}/act/${encodeURIComponent(entityId)}`;
  const noData = detail.fit === null;
  return (
    <div className="main shell">
      <main id="main" tabIndex={-1} className="stack">
        <div className="stack-sm">
          <a href={slateHref} className="back-link">
            Back to the slate
          </a>
          <h1 id="act-heading" dir="auto">
            <bdi>{act.name}</bdi>
          </h1>
          <p className="lead">{detail.rank !== null ? `Rank ${detail.rank} of ${detail.rankedCount}` : "Not ranked"}</p>
          <nav aria-label="On this page" className="on-page">
            <span>On this page:</span>
            <ul>
              {detail.sharedTastes.length > 0 ? (
                <li>
                  <a href="#tastes-heading">Shared tastes</a>
                </li>
              ) : null}
              <li>
                <a href="#evidence">Evidence trail</a>
              </li>
            </ul>
          </nav>
        </div>

        {noData ? (
          <EmptyState
            title={`No data for ${act.name}`}
            reason={`No Qloo data for this act. ${NO_DATA_REASON}`}
          />
        ) : null}

        <div className="tiles">
          <FitTile detail={detail} />
          <StandingTile detail={detail} />
          <CaveatsTile detail={detail} />
        </div>

        <WhyFit detail={detail} />

        {detail.sharedTastes.length > 0 ? (
          <section className="stack-sm wide-7" aria-labelledby="tastes-heading">
            <h2 id="tastes-heading">Shared tastes ({detail.sharedTastes.length})</h2>
            <SharedTastes rows={detail.sharedTastes} crowdTotal={detail.crowdCount} />
            {detail.fit ? <EvidenceLinks indexes={detail.fit.evidenceIndexes} /> : null}
          </section>
        ) : detail.fit === null ? (
          <section className="stack-sm" aria-labelledby="tastes-heading">
            <h2 id="tastes-heading">Shared tastes</h2>
            <p className="note" data-tone="neutral">
              <Icon name="unavailable" />
              <span>
                <strong>No shared tastes found.</strong> Qloo returned no tags shared between this act&apos;s audience and your crowd.
              </span>
            </p>
          </section>
        ) : null}

        <StandingSection detail={detail} />

        {/* Slot for "Other cities compared" (M2-03): lazily loaded city strength goes here, before the Evidence trail. */}

        <EvidenceTrail evidence={detail.evidence} />

        <nav aria-label="Other acts" className="prev-next">
          {detail.previous ? (
            <a href={href(detail.previous.entityId)} aria-label={`Previous act: ${isolate(detail.previous.name)}`}>
              Previous act:{" "}<bdi className="entity">{detail.previous.name}</bdi>
            </a>
          ) : (
            <span />
          )}
          {detail.next ? (
            <a href={href(detail.next.entityId)} aria-label={`Next act: ${isolate(detail.next.name)}`}>
              Next act:{" "}<bdi className="entity">{detail.next.name}</bdi>
            </a>
          ) : null}
        </nav>
      </main>
    </div>
  );
}
