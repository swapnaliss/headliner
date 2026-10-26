import type { ReactNode } from "react";

export const metadata = {
  title: "Headliner",
  description: "Audience-taste fit for independent venues. Aggregate affinity, not a ticket forecast.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
