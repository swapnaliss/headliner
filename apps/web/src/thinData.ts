import { CAVEAT_WORDING, THIN_DATA_WORDING_PLURAL } from "@headliner/core";

/** The sentence core writes for one thin city, and its plural form for two or more cities (owner-approved wording, 2026-10-29). */
const SINGULAR = CAVEAT_WORDING["thin-data"];
const PLURAL = THIN_DATA_WORDING_PLURAL;

/**
 * The one sentence shown for a merged caveat (design-system.md section 10: say a caveat sentence once per card). Identical
 * messages collapse to one; when several cities share core's thin-data sentence it is worded for "these cities". Any other
 * (different) messages are kept, in order, joined by a space.
 */
export function mergeThinMessages(messages: readonly string[]): string {
  const unique = [...new Set(messages)];
  if (unique.length === 1 && unique[0] === SINGULAR && messages.length >= 2) return PLURAL;
  return unique.join(" ");
}
