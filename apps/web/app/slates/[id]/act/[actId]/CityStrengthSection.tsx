"use client";

import type { Evidence } from "@headliner/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  groupRows,
  initialCities,
  MAX_CITIES,
  parseCityResponse,
  rowFromEntry,
  rowFromPersisted,
  sectionStatus,
  type PersistedCity,
  type RowState,
} from "../../../../../src/cityStrengthView";
import { Button } from "../../../../../src/ui/Button";
import { ErrorState } from "../../../../../src/ui/ErrorState";
import { Icon } from "../../../../../src/ui/Icon";
import { TextField } from "../../../../../src/ui/TextField";
import { ThinDataBadge } from "../../../../../src/ui/ThinDataBadge";
import { isolate, plural } from "../../../../../src/ui/text";

export interface CityStrengthSectionProps {
  slateId: string;
  actId: string;
  actName: string;
  /** The venue's city (plain text); always compared first. */
  roomCity: string;
  /** Aggregates already saved on the slate for this act. */
  persisted?: readonly PersistedCity[];
  /** The act's saved Evidence, so persisted rows keep their "Evidence" rows. */
  persistedEvidence?: readonly Evidence[];
  /** Read-only views (the shared slate) show saved rows and never call the endpoint. */
  readOnly?: boolean;
  /** Called with the cities that have thin data, once known, so the page can add them to its Caveats. */
  onThinCities?: (cities: readonly string[]) => void;
}

const CONCURRENCY = 3;
const key = (city: string): string => city.normalize("NFKC").toLowerCase();

const COPY = {
  heading: "Other cities compared",
  caption:
    "Mean affinity rank is the average of Qloo's affinity rank (0 to 1) across a city's heatmap cells, shown with the number of cells behind it. It is a different scale from Fit and from Qloo popularity rank. Qloo rescales raw affinity and popularity inside each city, so cities are compared only by these two numbers.",
  selection: "Cities compared: your venue's city and up to 4 others. They are not necessarily close to your venue.",
} as const;

/**
 * The lazy "Other cities compared" section (screen-act-detail.md, CityStrip): heatmap aggregates
 * load only when the section nears the viewport, one city at a time (at most 3 in flight), so
 * each row appears as its city completes. Aggregates only; every number has an Evidence row.
 */
export function CityStrengthSection({ slateId, actId, actName, roomCity, persisted = [], persistedEvidence = [], readOnly = false, onThinCities }: CityStrengthSectionProps) {
  const [cities, setCities] = useState<string[]>(() => (readOnly ? persisted.map((p) => p.city) : initialCities(roomCity)));
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const seeded: Record<string, RowState> = {};
    for (const p of persisted) seeded[key(p.city)] = rowFromPersisted(p);
    return seeded;
  });
  const [started, setStarted] = useState(false);
  const [noObserver, setNoObserver] = useState(false);
  const [offline, setOffline] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | undefined>(undefined);
  const router = useRouter();
  const refreshed = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const inFlight = useRef(new Set<string>());
  const queue = useRef<string[]>([]);
  const active = useRef(0);

  const patchRow = useCallback((city: string, row: RowState) => setRows((prev) => ({ ...prev, [key(city)]: row })), []);

  const fetchCity = useCallback(
    async (city: string): Promise<void> => {
      try {
        const res = await fetch(`/api/slates/${encodeURIComponent(slateId)}/acts/${encodeURIComponent(actId)}/cities`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cities: [city] }),
        });
        if (!res.ok) {
          patchRow(city, { kind: "failed", city, reason: res.status === 429 ? "refused" : "unavailable" });
          return;
        }
        const parsed = parseCityResponse(await res.json());
        const entry = parsed?.cities[0];
        if (!parsed || !entry) {
          patchRow(city, { kind: "failed", city, reason: "shape" });
          return;
        }
        patchRow(city, rowFromEntry({ ...entry, city }));
      } catch {
        if (typeof navigator !== "undefined" && navigator.onLine === false) setOffline(true);
        patchRow(city, { kind: "failed", city, reason: "network" });
      }
    },
    [slateId, actId, patchRow],
  );

  const pump = useCallback(() => {
    while (active.current < CONCURRENCY) {
      const next = queue.current.shift();
      if (next === undefined) return;
      active.current += 1;
      void fetchCity(next).finally(() => {
        active.current -= 1;
        inFlight.current.delete(key(next));
        pump();
      });
    }
  }, [fetchCity]);

  const enqueue = useCallback(
    (list: readonly string[]) => {
      for (const city of list) {
        if (inFlight.current.has(key(city))) continue;
        inFlight.current.add(key(city));
        patchRow(city, { kind: "pending", city });
        queue.current.push(city);
      }
      pump();
    },
    [patchRow, pump],
  );

  const start = useCallback(() => {
    if (readOnly) return;
    setStarted(true);
  }, [readOnly]);

  // Start when the section is within one screen of the viewport (spec: the calls are not spent unless the reader scrolls near).
  useEffect(() => {
    if (readOnly || started) return;
    const el = sectionRef.current;
    if (typeof IntersectionObserver === "undefined" || !el) {
      setNoObserver(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [readOnly, started, start]);

  // Once started, every city without a saved row is requested.
  useEffect(() => {
    if (!started) return;
    enqueue(cities.filter((c) => rows[key(c)] === undefined));
  }, [started, cities]);

  const shown: RowState[] = useMemo(() => cities.map((c) => rows[key(c)] ?? { kind: "pending" as const, city: c }), [cities, rows]);
  const status = sectionStatus(shown, started || shown.every((r) => r.kind !== "pending"));
  const groups = groupRows(shown);
  const total = shown.length;
  const done = total - groups.pending.length;
  const thinCities = groups.thin.map((r) => r.city);

  const thinKey = thinCities.join("\u0000");
  useEffect(() => {
    if (status === "ready" || status === "partial") onThinCities?.(thinKey ? thinKey.split("\u0000") : []);
  }, [status, thinKey, onThinCities]);

  // The saved aggregates also feed the page's Caveats tile and Evidence trail: re-read the server part once, after the first load.
  const loadedFresh = started && (status === "ready" || status === "partial") && groups.ranked.length + groups.thin.length > persisted.length;
  useEffect(() => {
    if (loadedFresh && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [loadedFresh, router]);


  const retry = (city: string): void => {
    inFlight.current.delete(key(city));
    setRows((prev) => {
      const next = { ...prev };
      delete next[key(city)];
      return next;
    });
    setStarted(true);
    // the effect above re-queues cities without a row
    setCities((prev) => [...prev]);
  };

  const addCity = (event: FormEvent): void => {
    event.preventDefault();
    const name = draft.trim();
    if (name.length === 0) return setDraftError("Enter a city name.");
    if (name.length > 80) return setDraftError("Use 80 characters or fewer.");
    if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(name)) return setDraftError("Remove control characters from the city name.");
    if (cities.some((c) => key(c) === key(name))) return setDraftError("That city is already compared.");
    if (cities.length >= MAX_CITIES) return setDraftError(`Up to ${MAX_CITIES} cities are compared for one act. Remove one first.`);
    setDraftError(undefined);
    setDraft("");
    setCities((prev) => [...prev, name]);
    setStarted(true);
  };

  const removeCity = (city: string): void => {
    setCities((prev) => prev.filter((c) => key(c) !== key(city)));
    setRows((prev) => {
      const next = { ...prev };
      delete next[key(city)];
      return next;
    });
  };

  const message =
    status === "loading"
      ? `Loading city strength: ${done} of ${total} cities.`
      : (status === "ready" || status === "partial") && total > 0
        ? `City strength loaded for ${done - groups.failed.length}${groups.failed.length > 0 ? ` of ${total}` : ""} ${plural(groups.failed.length > 0 ? total : done, "city", "cities")}.${thinCities.length > 0 ? ` ${thinCities.length} ${plural(thinCities.length, "has", "have")} thin data.` : ""}`
        : "";

  const venue = key(roomCity);
  // Row links point into the page's Evidence trail (same numbering as M2-02: position in the act's saved evidence).
  const evidenceLink = (refs: readonly string[]) => {
    const n = refs[0] ? persistedEvidence.findIndex((e) => e.id === refs[0]) + 1 : 0;
    return n > 0 ? (
      <a className="city-evidence-link" href={`#ev-${n}`}>
        See evidence: {n}
      </a>
    ) : null;
  };
  const rowFor = (r: Extract<RowState, { kind: "ok" }>) => (
    <li key={key(r.city)} className="city-row" data-thin={r.thin ? "true" : undefined}>
      <div className="city-name">
        <span className="entity" dir="auto">
          <bdi>{r.city}</bdi>
        </span>
        {key(r.city) === venue ? <span className="status" data-tone="info">Your venue&apos;s city</span> : null}
      </div>
      <div className="city-meter" aria-hidden="true">
        <span className="city-bar" style={{ inlineSize: `${Math.round(r.meanAffinityRank * 100)}%` }} />
      </div>
      <div className="city-figures">
        <span className="num">Mean affinity rank {r.meanAffinityRank.toFixed(3)}</span>
        <span className="num">
          {r.cellCount} {plural(r.cellCount, "cell", "cells")}
        </span>
        {evidenceLink(r.evidenceRefs)}
      </div>
      {r.thin ? <ThinDataBadge cellCount={r.cellCount} variant="block" /> : null}
    </li>
  );

  return (
    <section ref={sectionRef} id="cities" className="stack" aria-labelledby="cities-heading" data-status={status}>
      <h2 id="cities-heading">{COPY.heading}</h2>
      <p className="field-hint">{COPY.caption}</p>
      <p className="field-hint">{COPY.selection}</p>

      {readOnly && cities.length === 0 ? <p className="note" data-tone="neutral">City strength was not loaded for this act on this slate.</p> : null}

      <div role="status" aria-live="polite" className="city-status">
        {message ? <p>{message}</p> : null}
        {offline ? <p>You appear to be offline. The page is shown as last loaded; city strength cannot load.</p> : null}
      </div>

      {status === "idle" ? (
        <div className="stack-sm">
          <ul className="city-list" aria-label="Cities compared" aria-busy="true">
            <li className="city-row" data-skeleton="true">
              <span className="sr-only">Waiting to load city strength</span>
              <span className="skeleton-line" />
            </li>
          </ul>
          {noObserver && !readOnly ? <Button variant="secondary" onClick={start}>Load city strength</Button> : null}
        </div>
      ) : null}

      {status === "error" ? (
        <ErrorState
          title="Could not load city strength"
          message="The rest of this page is unaffected."
          actions={<Button variant="secondary" onClick={() => groups.failed.forEach((r) => retry(r.city))}>Try again</Button>}
        />
      ) : null}

      {status !== "idle" && status !== "error" ? (
        <div className="stack-sm">
          <ul className="city-list" aria-label="Cities compared" aria-busy={status === "loading" ? "true" : undefined}>
            {groups.ranked.map(rowFor)}
            {groups.pending.map((r) => (
              <li key={key(r.city)} className="city-row" data-skeleton="true">
                <span className="sr-only">{`Loading ${isolate(r.city)}`}</span>
                <span className="skeleton-line" />
              </li>
            ))}
            {groups.failed.map((r) => (
              <li key={key(r.city)} className="city-row">
                <div className="city-name">
                  <span className="status" data-tone="error">
                    <Icon name="error" />
                    <span>
                      Could not load <bdi className="entity">{r.city}</bdi>
                    </span>
                  </span>
                </div>
                <Button variant="secondary" onClick={() => retry(r.city)}>Try again</Button>
              </li>
            ))}
          </ul>
          {groups.thin.length > 0 ? (
            <div className="stack-sm">
              <h3>Thin data: read with caution</h3>
              <ul className="city-list" aria-label="Cities with thin data">
                {groups.thin.map(rowFor)}
              </ul>
            </div>
          ) : null}
          {groups.zero.length > 0 ? (
            <div className="stack-sm">
              <h3>No heatmap data</h3>
              <ul className="city-list" aria-label="Cities with no heatmap data">
            {groups.zero.map((r) => (
              <li key={key(r.city)} className="city-row">
                <div className="city-name">
                  <span className="entity" dir="auto">
                    <bdi>{r.city}</bdi>
                  </span>
                  {key(r.city) === venue ? <span className="status" data-tone="info">Your venue&apos;s city</span> : null}
                </div>
                <div className="state" data-tone="neutral" data-compact="true">
                  <div className="state-head">
                    <Icon name="unavailable" />
                    <p className="state-title">
                      No heatmap cells for <bdi className="entity">{r.city}</bdi>
                    </p>
                  </div>
                  <p>Qloo returned no usable audience data there.</p>
                </div>
                {evidenceLink(r.evidenceRefs)}
              </li>
            ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {!readOnly ? (
        <form className="stack-sm city-add" onSubmit={addCity} noValidate>
          <TextField
            id="city-add"
            label="Compare another city"
            hint={`Up to ${MAX_CITIES} cities per act, including your venue's city. Names only; nothing personal.`}
            value={draft}
            onChange={setDraft}
            maxLength={80}
            error={draftError}
          />
          <div className="chip-row">
            <Button type="submit" variant="secondary">Add city</Button>
            {cities
              .filter((c) => key(c) !== venue)
              .map((c) => (
                <span key={key(c)} className="act-chip">
                  <span className="act-chip-name" dir="auto">
                    <bdi>{c}</bdi>
                  </span>
                  <button type="button" className="chip-remove" aria-label={`Remove ${isolate(c)} from the cities compared for ${isolate(actName)}`} onClick={() => removeCity(c)}>
                    <Icon name="remove" />
                  </button>
                </span>
              ))}
          </div>
        </form>
      ) : null}

    </section>
  );
}
