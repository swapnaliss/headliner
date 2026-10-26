/** A scoring function that cannot produce a number returns this, never a zero. */
export interface Unavailable {
  readonly status: "unavailable";
  readonly reason: string;
}

export function unavailable(reason: string): Unavailable {
  return { status: "unavailable", reason };
}

/** True for a finite number in the closed interval 0..1. */
export function isUnitInterval(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Round half away from zero to `places` decimals, deterministically. */
export function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Code-unit string comparison: locale-independent, so ordering is identical everywhere. */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
