/** Unicode first-strong isolates (U+2068, U+2069): keeps a right-to-left name from reordering an `aria-label` or live-region sentence. */
export function isolate(name: string): string {
  return `⁨${name}⁩`;
}

/** The exact strings the specs fix (docs/design). Kept in one place so tests and pages agree. */
export const COPY = {
  banner: "Audience-taste fit is aggregate affinity, not a ticket forecast.",
  bannerRest:
    "It compares the tastes of each act's audience with your regular crowd, using Qloo data. It says nothing about sales, attendance or any individual.",
  standingCaption: "Qloo popularity rank",
  standingScale: "Higher is better known on Qloo.",
} as const;

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
