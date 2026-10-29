import type { ReactNode } from "react";

export type IconName = "info" | "check" | "caution" | "unavailable" | "error" | "thin" | "spinner" | "remove" | "above" | "similar" | "below" | "chevron";

const common = {
  className: "icon",
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "square" as const,
  "aria-hidden": true,
  focusable: false,
};

const shapes: Record<IconName, ReactNode> = {
  info: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v4M8 4.75v.5" />
    </>
  ),
  check: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M5 8.25l2 2 4-4.5" />
    </>
  ),
  caution: (
    <>
      <path d="M8 2l6.25 11H1.75z" />
      <path d="M8 6.5v3.25M8 11.5v.5" />
    </>
  ),
  unavailable: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M5 8h6" />
    </>
  ),
  error: (
    <>
      <path d="M5.2 1.75h5.6l3.45 3.45v5.6l-3.45 3.45H5.2L1.75 10.8V5.2z" />
      <path d="M5.75 5.75l4.5 4.5M10.25 5.75l-4.5 4.5" />
    </>
  ),
  thin: (
    <>
      <path d="M3 13V8M8 13V5M13 13V2" strokeDasharray="1.5 1.5" />
      <path d="M3 13V8M8 13V5" strokeDasharray="none" />
    </>
  ),
  spinner: <path d="M8 1.75a6.25 6.25 0 1 0 6.25 6.25" />,
  remove: <path d="M4 4l8 8M12 4l-8 8" />,
  chevron: <path d="M6 3l5 5-5 5" />,
  // Standing glyphs: a median line with a dot above, on, or below it (never an arrow).
  above: (
    <>
      <path d="M2 10h12" />
      <circle cx="8" cy="4.5" r="1.75" fill="currentColor" />
    </>
  ),
  similar: (
    <>
      <path d="M2 8h12" />
      <circle cx="8" cy="8" r="1.75" fill="currentColor" />
    </>
  ),
  below: (
    <>
      <path d="M2 6h12" />
      <circle cx="8" cy="11.5" r="1.75" fill="currentColor" />
    </>
  ),
};

/** Decorative inline SVG. Always `aria-hidden`; the adjacent text carries the meaning. */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg {...common} className={name === "spinner" ? "icon spinner" : name === "chevron" ? "icon icon-chevron" : "icon"}>
      {shapes[name]}
    </svg>
  );
}
