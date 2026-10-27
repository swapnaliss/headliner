import type { ReactNode } from "react";
import type { Slate } from "@headliner/core";
import { SLATE_TTL_MS } from "@headliner/slates";
import { actDetailPath } from "../actDetail";
import { isSampleId } from "../sampleId";
import { buildSlateView } from "../slateView";
import { ActCard } from "./ActCard";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { ShareLink } from "./ShareLink";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function keptUntil(createdAt: string): { created: string; until: string } | null {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return { created: DAY.format(created), until: DAY.format(new Date(created.getTime() + SLATE_TTL_MS)) };
}

export interface SlateViewProps {
  slate: Slate;
  /** The read-only shared page (`/s/{id}`): no share or change-room controls, a "Shared slate" line and a link to start your own. */
  shared?: boolean;
  /** Fixtures mode keeps slates in memory only; the share note says so. */
  ephemeral?: boolean;
  /** The Explanation block (M3-02), placed after the notes and before the ranked list. */
  explanation?: ReactNode;
}

/** The slate screen (docs/design/screen-slate.md): ranked ActCards, the Not ranked group, comparison and room summary. */
export function SlateView({ slate, shared = false, ephemeral = false, explanation }: SlateViewProps) {
  const view = buildSlateView(slate);
  const base = shared ? "/s" : "/slates";
  const life = keptUntil(slate.createdAt);
  const total = slate.results.length;
  const rankedCount = view.ranked.length;
  const crowd = slate.room.crowdActs;
  return (
    <div className="main shell">
      <div className="two-col">
        <main id="main" tabIndex={-1} className="stack">
          <div className="stack-sm">
            <h1 id="slate-heading">
              Slate for <bdi>{slate.room.city}</bdi>
            </h1>
            <p className="lead">Ranked by audience-taste fit with your crowd</p>
            {shared && life ? (
              <p className="field-hint shared-line" data-testid="shared-line">
                {isSampleId(slate.id) ? `Sample slate, created ${life.created}. It does not expire.` : `Shared slate, created ${life.created}. Kept until ${life.until}.`}
              </p>
            ) : null}
            <details className="disclosure">
              <summary>
                Compared with {crowd.length} crowd {crowd.length === 1 ? "act" : "acts"}
              </summary>
              <ul className="chip-row" aria-label="Crowd acts compared">
                {crowd.map((act) => (
                  <li key={act.qlooEntityId} className="tag-chip">
                    <bdi className="entity" dir="auto">
                      {act.name}
                    </bdi>
                  </li>
                ))}
              </ul>
            </details>
            {rankedCount > 0 ? (
              <p className="field-hint">
                Fit is the mean Qloo tag score shared between an act&apos;s audience and your crowd, from 0 to 100. Read the rank first: Fit values are often close together.
              </p>
            ) : null}
          </div>

          {view.close && view.spread !== null ? (
            <p className="note" data-tone="info" role="note">
              <Icon name="info" />
              <span>Fit values span {view.spread.toFixed(1)} points. Treat neighbouring ranks as close.</span>
            </p>
          ) : null}

          {view.unranked.length > 0 && rankedCount > 0 ? (
            <p className="note" data-tone="caution" role="note">
              <Icon name="caution" />
              <span>
                {view.unranked.length} of {total} acts could not be scored. They are listed below with the reason.
              </span>
            </p>
          ) : null}

          {slate.notes.length > 0 ? (
            <ul className="stack-sm" aria-label="Notes about your entries" data-testid="slate-notes">
              {slate.notes.map((note, index) => (
                <li key={`${note.type}-${index}`} className="note" data-tone="neutral">
                  <Icon name="info" />
                  <span>
                    {note.subject ? (
                      <>
                        <bdi className="entity" dir="auto">
                          {note.subject}
                        </bdi>
                        :{" "}
                      </>
                    ) : null}
                    {note.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {explanation ?? null}

          {rankedCount > 0 ? (
            <section className="stack" aria-labelledby="ranked-heading">
              <h2 id="ranked-heading">Ranked acts ({rankedCount})</h2>
              <ol className="card-list" aria-label="Ranked acts">
                {view.ranked.map((result) => (
                  <ActCard key={result.act.qlooEntityId} result={result} rankedCount={rankedCount} tiedWithPrevious={view.tied.has(result.act.qlooEntityId)} detailHref={actDetailPath(slate.id, result.act.qlooEntityId, base)} />
                ))}
              </ol>
            </section>
          ) : (
            <EmptyState
              title="No act could be scored."
              reason="Qloo returned no usable data for any candidate. Check the names, or try different acts."
              action={
                <a className="btn" data-variant="secondary" href="/">
                  {shared ? "Make your own slate" : "Back to edit the room"}
                </a>
              }
            />
          )}

          {view.unranked.length > 0 ? (
            <section className="stack" aria-labelledby="unranked-heading">
              <h2 id="unranked-heading">Not ranked ({view.unranked.length})</h2>
              <ul className="card-list" aria-label="Acts that could not be ranked">
                {view.unranked.map((result) => (
                  <ActCard key={result.act.qlooEntityId} result={result} rankedCount={rankedCount} detailHref={actDetailPath(slate.id, result.act.qlooEntityId, base)} />
                ))}
              </ul>
            </section>
          ) : null}
        </main>

        <aside className="stack" aria-label="Compare orders and room">
          {view.comparison.length >= 2 ? (
            <section className="panel" aria-labelledby="compare-heading">
              <h2 id="compare-heading">Compare with Qloo popularity rank order</h2>
              <p>{view.differing === 0 ? "The two orders match." : `The orders differ: ${view.differing} of ${view.comparison.length} acts sit in a different position.`}</p>
              <div className="table-wrap" role="region" aria-label="Fit position and popularity position table" tabIndex={0}>
                <table>
                  <caption>Fit position and popularity position for each ranked act</caption>
                  <thead>
                    <tr>
                      <th scope="col">Act</th>
                      <th scope="col" className="num">
                        Fit position
                      </th>
                      <th scope="col" className="num">
                        Popularity position
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.comparison.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">
                          <bdi className="entity" dir="auto">
                            {row.name}
                          </bdi>
                        </th>
                        <td className="num">{row.fitPosition}</td>
                        <td className="num">{row.popularityPosition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="field-hint">Derived from the Fit and Qloo popularity rank values above.</p>
              <p className="field-hint">
                Qloo popularity rank shows how well known an act is on Qloo. Fit shows how close its audience is to your crowd. They answer different questions.
              </p>
            </section>
          ) : null}
          {shared ? null : (
            <section className="panel" aria-labelledby="share-heading">
              <h2 id="share-heading">Share this slate</h2>
              <p>
                Anyone with the link can open this read-only slate for 30 days. It shows the city, the crowd acts and the candidate acts as resolved Qloo names, each act&apos;s Fit, shared tastes, Qloo popularity rank and caveats, and the Qloo evidence. It shows nothing you typed. The link contains a random, unguessable id; share it only with people you trust.
              </p>
              {ephemeral ? (
                <p className="note" data-tone="info" role="note">
                  <Icon name="info" />
                  <span>Demo mode keeps slates in memory only. This link works while the demo server stays running and is not saved.</span>
                </p>
              ) : null}
              <ShareLink path={`/s/${slate.id}`} />
            </section>
          )}
          <section className="panel" aria-labelledby="room-used-heading">
            <h2 id="room-used-heading">Room used</h2>
            <p>
              <bdi>{slate.room.city}</bdi>; crowd: {crowd.length} {crowd.length === 1 ? "act" : "acts"}
            </p>
            <a className="btn" data-variant="secondary" href="/">
              {shared ? "Make your own slate" : "Change room"}
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
