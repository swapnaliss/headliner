import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { demoMode } from "../src/env";
import { Banner } from "../src/ui/Banner";
import { Icon } from "../src/ui/Icon";
import "./tokens.css";
import "./globals.css";

// The one display face (design-system.md section 2): Source Serif 4, variable weight 600-700, Latin, SIL OFL, served
// from this origin (CSP font-src 'self'). This call makes Next emit the same-origin <link rel="preload"> for the file.
// globals.css puts the loaded family first in --font-display; tokens.css is untouched. Next's generated size-adjusted fallback is off
// (unmeasured against the spec's Georgia stack), so the fallback is the spec's plain stack.
const sourceSerif = localFont({
  src: "./fonts/source-serif-4-latin-wght-normal.woff2",
  weight: "600 700",
  style: "normal",
  display: "swap",
  preload: true,
  variable: "--font-source-serif",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: { default: "Headliner", template: "%s: Headliner" },
  description:
    "Audience-taste fit for independent venues: aggregate affinity, not a ticket forecast.",
};

// Zoom is never disabled (no maximum-scale, no user-scalable=no).
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// The demo-mode chip reads the runtime environment, so pages are rendered per request, not baked at build time.
export const dynamic = "force-dynamic";

const REPO = "https://github.com/swapnaliss/headliner";

/** The wordmark mark: a flat 24px accent square with an "H" cut out in the canvas colour, crossbar above the middle. Decorative. */
function Mark() {
  return (
    <svg
      className="brand-mark"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="24" height="24" rx="4" />
      <path fillRule="evenodd" d="M6.5 5h3v3.75h5V5h3v14h-3v-7.25h-5V19h-3z" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const fixtures = demoMode() === "fixtures";
  return (
    <html lang="en" className={sourceSerif.variable}>
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <header className="site-header shell">
          <div className="header-row">
            <a className="brand" href="/">
              <Mark />
              <span className="brand-name">Headliner</span>
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
