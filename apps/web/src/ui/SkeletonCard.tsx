/** Placeholder with the same outer size as an ActCard. Hidden from assistive technology; the progress text carries the meaning. */
export function SkeletonCard({ lines = 4 }: { lines?: number }) {
  return (
    <li className="skeleton" aria-hidden="true" data-testid="skeleton-card">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton-line" />
      ))}
    </li>
  );
}

/** A busy list of skeletons; the container is `aria-busy` while loading. */
export function SkeletonList({ count, label }: { count: number; label: string }) {
  return (
    <ol className="card-list" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </ol>
  );
}
