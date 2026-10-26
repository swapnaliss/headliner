import { Icon } from "./Icon";
import { COPY } from "./text";

/** The reading note on every screen. Static copy, not dismissible, not collapsible, never hidden. */
export function Banner() {
  return (
    <aside className="banner" role="note" aria-label="How to read this page">
      <Icon name="info" />
      <div className="banner-body">
        <p>
          <strong>{COPY.banner}</strong> <span className="banner-rest">{COPY.bannerRest}</span>
        </p>
        <details className="banner-details">
          <summary>What this means</summary>
          <p>{COPY.bannerRest}</p>
        </details>
      </div>
    </aside>
  );
}
