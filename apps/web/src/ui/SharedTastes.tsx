"use client";

import { useState } from "react";
import { Button } from "./Button";

export interface TasteRow {
  tagId: string;
  name: string;
  score: number;
  covered: number | null;
  evidenceIndexes: readonly number[];
}

const FIRST = 10;

/** Shared tastes table: the first 10 tags, then "Show all n". Tag names are Qloo text: plain text only. */
export function SharedTastes({ rows, crowdTotal }: { rows: readonly TasteRow[]; crowdTotal: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, FIRST);
  const more = rows.length > FIRST;
  const showCovered = rows.every((r) => r.covered !== null);
  return (
    <div className="stack-sm" id="tastes">
      <div className="table-wrap" role="region" aria-label="Shared tastes table" tabIndex={0}>
        <table>
          <caption>
            Tags that Qloo finds in both this act&apos;s audience and your crowd&apos;s. Score is the Qloo tag score from 0 to 1.
          </caption>
          <thead>
            <tr>
              <th scope="col">Tag</th>
              <th scope="col" className="num">
                Score
              </th>
              {showCovered ? (
                <th scope="col" className="num">
                  Crowd acts covered
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.tagId}>
                <th scope="row">
                  <bdi className="entity" dir="auto">
                    {row.name}
                  </bdi>
                </th>
                <td className="num">{row.score.toFixed(2)}</td>
                {showCovered ? (
                  <td className="num">
                    {row.covered} of {crowdTotal}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {more ? (
        <Button variant="secondary" onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </Button>
      ) : null}
      <span role="status" className="sr-only">
        {more ? (all ? `Showing all ${rows.length} shared tastes.` : `Showing the first ${FIRST} shared tastes.`) : ""}
      </span>
    </div>
  );
}
