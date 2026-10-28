import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { demoMode } from "../src/env";
import { Banner } from "../src/ui/Banner";
import { Icon } from "../src/ui/Icon";
import "./tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Headliner", template: "%s: Headliner" },
  description: "Audience-taste fit for independent venues: aggregate affinity, not a ticket forecast.",
};

// Zoom is never disabled (no maximum-scale, no user-scalable=no).
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// The demo-mode chip reads the runtime environment, so pages are rendered per request, not baked at build time.
export const dynamic = "force-dynamic";

const REPO = "https://github.com/swapnaliss/headliner";

export default function RootLayout({ children }: { children: ReactNode }) {
  const fixtures = demoMode() === "fixtures";
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <header className="site-header shell">
          <div className="header-row">
            <a className="brand" href="/">
              Headliner
            </a>
            {fixtures ? (
              <span className="status" data-tone="info">
                <Icon name="info" />
                <span>Demo mode: recorded Qloo responses</span>
              </span>
            ) : null}
          </div>
          <Banner />
        </header>
        {children}
        <footer className="site-footer shell">
          <ul>
            <li>
              <a href={`${REPO}/blob/main/LICENSE`}>About and licence</a>
            </li>
            <li>
              <a href={REPO}>Source on GitHub</a>
            </li>
          </ul>
        </footer>
      </body>
    </html>
  );
}
