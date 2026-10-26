import type { Evidence } from "@headliner/core";

/**
 * Wire shapes of `POST /api/slates/:id/acts/:actId/cities` (M2-03). Aggregates only: a city has a
 * mean affinity rank and a cell count, never a grid. City strings are untrusted: render as plain text.
 */
export type CityNoDataReason = "zero_cells" | "timeout" | "rate_limited" | "unavailable" | "shape" | "bad_request";

export type CityEntry =
  | {
      readonly city: string;
      readonly status: "ok";
      /** Mean Qloo affinity rank, 0..1, three decimals. Compare cities with this and `cellCount` only. */
      readonly meanAffinityRank: number;
      readonly cellCount: number;
      /** True when fewer than 15 heatmap cells back the mean. */
      readonly thin: boolean;
      readonly evidenceRefs: readonly string[];
    }
  | {
      readonly city: string;
      readonly status: "no_data";
      readonly reason: CityNoDataReason;
      /** Present for `zero_cells` (the call happened and returned nothing usable). */
      readonly evidenceRefs: readonly string[];
    };

export interface CityCaveat {
  readonly code: "thin_city_data";
  readonly city: string;
  readonly message: string;
}

export interface CityStrengthResponse {
  readonly status: "done";
  readonly actId: string;
  /** In request order (duplicates removed). */
  readonly cities: readonly CityEntry[];
  /** One `thin_city_data` caveat per thin city. */
  readonly caveats: readonly CityCaveat[];
  /** The Evidence behind the numbers in `cities` (redacted request summaries). */
  readonly evidence: readonly Evidence[];
}
