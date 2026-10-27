// Home-city check (M3-04). For each listed act: resolve the entity, run the heatmap for every city of the set
// through the adapter, summarise each city with the core city-strength function, and record whether the act's
// documented home city has the highest mean affinity_rank. Heatmap affinity and popularity are rescaled per
// city (ADR 0013), so only mean affinity_rank and cell count are compared. No target is applied anywhere.
import { cityStrengthFromAggregate } from "../../packages/core/src/index";
import { fetchHeatmap, type QlooClient } from "../../packages/qloo/src/index";
import { resolveName, type HomeCitySet, type Resolution } from "./common";

export interface CityRow {
  readonly city: string;
  readonly status: "ok" | "no_data";
  /** Mean affinity_rank (0..1, three decimals) or null when there is no usable cell. */
  readonly meanAffinityRank: number | null;
  readonly cellCount: number;
  /** Fewer than 15 cells (ADR 0013), including none. */
  readonly thin: boolean;
  readonly reason?: string;
}

export interface ActRow {
  readonly name: string;
  readonly homeCity: string;
  readonly continent: string;
  readonly source: string;
  readonly resolution: Resolution;
  readonly cities: readonly CityRow[];
  /** City with the highest mean affinity_rank among cities that have one (ties: more cells), thin cities included. */
  readonly strongestCity: string | null;
  /** 1-based position of the home city by mean affinity_rank (same ordering), or null when it has no mean. */
  readonly homeRank: number | null;
  /** Home city has the highest mean affinity_rank of all cities with a mean (thin included, flagged). Null when unresolved. */
  readonly hit: boolean | null;
  /** Stricter reading: the home city itself is not thin and is highest among cities that are not thin. Null when unresolved. */
  readonly hitEnoughData: boolean | null;
}

export interface HomeCityResult {
  readonly acts: readonly ActRow[];
  readonly summary: {
    readonly listed: number;
    readonly resolved: number;
    readonly unresolved: number;
    readonly hits: number;
    readonly hitsEnoughData: number;
    /** Resolved acts whose own home-city heatmap is thin. */
    readonly homeCityThin: number;
    /** Resolved acts with at least one thin city among the set's cities. */
    readonly actsWithAnyThinCity: number;
    readonly cityCount: number;
    readonly continentCount: number;
  };
}

const order = (a: CityRow, b: CityRow): number =>
  (b.meanAffinityRank ?? -1) - (a.meanAffinityRank ?? -1) || b.cellCount - a.cellCount || (a.city < b.city ? -1 : a.city > b.city ? 1 : 0);

export async function runHomeCity(client: QlooClient, set: HomeCitySet): Promise<HomeCityResult> {
  const acts: ActRow[] = [];
  for (const act of set.acts) {
    const resolution = await resolveName(client, act.name);
    let cities: CityRow[] = [];
    if (resolution.status === "resolved") {
      cities = await Promise.all(
        set.cities.map(async (city): Promise<CityRow> => {
          const out = await fetchHeatmap(client, { entityId: resolution.entityId, city });
          if (out.status === "no_data") return { city, status: "no_data", meanAffinityRank: null, cellCount: 0, thin: true, reason: out.reason };
          const s = cityStrengthFromAggregate(out.aggregate);
          return { city, status: "ok", meanAffinityRank: s.meanAffinityRank, cellCount: s.cellCount, thin: s.thin };
        }),
      );
    }
    const withMean = cities.filter((c) => c.meanAffinityRank !== null).sort(order);
    const enough = withMean.filter((c) => !c.thin);
    const home = withMean.findIndex((c) => c.city === act.homeCity);
    const resolved = resolution.status === "resolved";
    acts.push({
      ...act,
      resolution,
      cities,
      strongestCity: withMean[0]?.city ?? null,
      homeRank: home >= 0 ? home + 1 : null,
      hit: resolved ? withMean[0]?.city === act.homeCity : null,
      hitEnoughData: resolved ? enough[0]?.city === act.homeCity : null,
    });
  }
  const resolvedActs = acts.filter((a) => a.resolution.status === "resolved");
  return {
    acts,
    summary: {
      listed: acts.length,
      resolved: resolvedActs.length,
      unresolved: acts.length - resolvedActs.length,
      hits: acts.filter((a) => a.hit === true).length,
      hitsEnoughData: acts.filter((a) => a.hitEnoughData === true).length,
      homeCityThin: resolvedActs.filter((a) => a.cities.find((c) => c.city === a.homeCity)?.thin === true).length,
      actsWithAnyThinCity: resolvedActs.filter((a) => a.cities.some((c) => c.thin)).length,
      cityCount: new Set(set.acts.map((a) => a.homeCity)).size,
      continentCount: new Set(set.acts.map((a) => a.continent)).size,
    },
  };
}
