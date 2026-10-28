import { ProgressStatus } from "./ProgressStatus";
import { SkeletonList } from "./SkeletonCard";

export interface LoadingProps {
  /** Heading text, for example "Ranking in progress". Also names the busy region. */
  title: string;
  /** The sentence announced politely: what is loading. A spinner or skeleton alone never counts (L-05). */
  message: string;
  slowNotice?: string | undefined;
  /** Skeleton cards shown under the text (hidden from assistive technology). 0 shows the text only. */
  skeletons?: number;
  skeletonLabel?: string;
  id?: string;
}

/** The loading state of a screen: a titled `aria-busy` region, one polite status sentence, optional skeletons. */
export function Loading({ title, message, slowNotice, skeletons = 0, skeletonLabel = "Loading", id = "loading-heading" }: LoadingProps) {
  return (
    <section className="stack" aria-labelledby={id} aria-busy="true" data-testid="loading">
      <h2 id={id}>{title}</h2>
      <ProgressStatus message={message} slowNotice={slowNotice} />
      {skeletons > 0 ? <SkeletonList count={skeletons} label={skeletonLabel} /> : null}
    </section>
  );
}
