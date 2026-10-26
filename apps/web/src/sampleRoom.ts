/**
 * The recorded sample room (docs/design/screen-room-setup.md): a Berlin crowd and three candidates
 * whose Qloo responses are recorded in `fixtures/qloo`. Names are real Qloo-resolved artists.
 * The crowd ORDER matters for fixture replay (M1-03 handoff), so it is kept exactly.
 */
export const SAMPLE_ROOM = {
  city: "Berlin",
  crowdActs: ["Apparat", "Moderat", "Modeselektor", "Hundreds", "Brandt Brauer Frick", "Boys Noize"],
  candidateActs: ["Khruangbin", "Radiohead", "Reality Club"],
} as const;
