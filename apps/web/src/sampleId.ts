/** Ids of pinned sample slates (M2-06): `sample-<slug>`. Kept free of imports so the slate store can use it. */
export const SAMPLE_ID_PREFIX = "sample-";
export const SAMPLE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function sampleId(slug: string): string {
  return `${SAMPLE_ID_PREFIX}${slug}`;
}

/** True for an id shaped like a sample id. Only the prewarm script can create such a slate. */
export function isSampleId(value: string): boolean {
  return value.length <= 60 && value.startsWith(SAMPLE_ID_PREFIX) && SAMPLE_SLUG.test(value.slice(SAMPLE_ID_PREFIX.length));
}
