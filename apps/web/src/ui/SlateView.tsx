import type { Slate } from "@headliner/core";
import { buildSlateView } from "../slateView";
import { ActCard } from "./ActCard";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";

/** The slate screen (docs/design/screen-slate.md): ranked ActCards, the Not ranked group, comparison and room summary. */
export function SlateView({ slate }: { slate: Slate }) {
  const view = buildSlateView(slate);
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
            <details className="disclosure">
              <summary>
                Compared with {crowd.length} crowd {crowd.length === 1 ? "act" : "acts"}: show crowd acts
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
            <p className="field-hint">
              Fit is the mean Qloo tag score shared between an act&apos;s audience and your crowd, from 0 to 100. Read the rank first: Fit values are often close together.
            </p>
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

          {rankedCount > 0 ? (
            <section className="stack" aria-labelledby="ranked-heading">
              <h2 id="ranked-heading">Ranked acts ({rankedCount})</h2>
              <ol className="card-list" aria-label="Ranked acts">
                {view.ranked.map((result) => (
                  <ActCard key={result.act.qlooEntityId} result={result} rankedCount={rankedCount} tiedWithPrevious={view.tied.has(result.act.qlooEntityId)} />
                ))}
              </ol>
            </section>
          ) : (
            <EmptyState
              title="No act could be scored."
              reason="Qloo returned no usable data for any candidate. Check the names, or try different acts."
              action={
                <a className="btn" data-variant="secondary" href="/">
                  Back to edit the room
                </a>
              }
            />
          )}

          {view.unranked.length > 0 ? (
            <section className="stack" aria-labelledby="unranked-heading">
              <h2 id="unranked-heading">Not ranked ({view.unranked.length})</h2>
              <ul className="card-list" aria-label="Acts that could not be ranked">
                {view.unranked.map((result) => (
                  <ActCard key={result.act.qlooEntityId} result={result} rankedCount={rankedCount} />
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
              <div className="table-wrap">
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
          <section className="panel" aria-labelledby="room-used-heading">
            <h2 id="room-used-heading">Room used</h2>
            <p>
              <bdi>{slate.room.city}</bdi>; crowd: {crowd.length} {crowd.length === 1 ? "act" : "acts"}
            </p>
            <a className="btn" data-variant="secondary" href="/">
              Change room
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
