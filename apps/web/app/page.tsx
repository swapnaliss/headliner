import type { Metadata } from "next";
import { displayedDailyQlooCalls } from "../src/budget";
import { demoMode } from "../src/env";
import { sampleLinks } from "../src/samples";
import { DemoLimits } from "../src/ui/DemoLimits";
import { RoomForm } from "../src/ui/RoomForm";
import { SampleRooms } from "../src/ui/SampleRooms";

export const metadata: Metadata = { title: "Room setup" };

export default function Home() {
  return (
    <main id="main" tabIndex={-1} className="main shell">
      <div className="two-col">
        <div className="stack">
          <div className="stack-sm">
            <h1>Rank the acts you are considering by audience-taste fit</h1>
            <p className="lead">
              Headliner compares each act&apos;s audience with the artists your regulars already follow, using Qloo taste data, and shows the evidence behind every number.
            </p>
          </div>
          <SampleRooms samples={sampleLinks()} />
          <RoomForm demoMode={demoMode() === "fixtures"} />
        </div>
        <div className="stack">
          <section className="panel" aria-labelledby="how-heading">
            <h2 id="how-heading">How it works</h2>
            <ol className="steps">
              <li>Describe the room.</li>
              <li>Rank the acts.</li>
              <li>Read the ranked slate and the evidence behind each number.</li>
            </ol>
          </section>
          <section className="panel" aria-labelledby="get-heading">
            <h2 id="get-heading">What you get</h2>
            <p>A ranked slate. Each act shows Fit, shared tastes, Qloo popularity rank, caveats and the Qloo calls behind every number.</p>
          </section>
          <DemoLimits recorded={demoMode() === "fixtures"} dailyQlooCalls={displayedDailyQlooCalls()} />
        </div>
      </div>
    </main>
  );
}
