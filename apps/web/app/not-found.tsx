import { EmptyState } from "../src/ui/EmptyState";

export const metadata = { title: { absolute: "Not found: Headliner" } };

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="main shell">
      <EmptyState
        level={1}
        title="This slate is no longer available."
        reason="Slates are kept for 30 days. The link may be wrong or the slate may have expired."
        action={
          <a className="btn" data-variant="primary" href="/">
            Start a new slate
          </a>
        }
      />
    </main>
  );
}
