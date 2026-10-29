import type { Metadata } from "next";
import { displayedDailyQlooCalls } from "../src/budget";
import { demoMode } from "../src/env";
import { sampleLinks } from "../src/samples";
import { DemoLimits } from "../src/ui/DemoLimits";
import { RoomForm } from "../src/ui/RoomForm";
import { SampleRooms } from "../src/ui/SampleRooms";

// The root segment shares the layout, so its title template does not apply here: the full title is written out (A-04).
export const metadata: Metadata = { title: { absolute: "Room setup: Headliner" } };

export default function Home() {
  const recorded = demoMode() === "fixtures";
  const samples = sampleLinks();
  return (
    <main id="main" tabIndex={-1} className="main shell room">
      <div className="room-intro stack">
        <div className="stack-sm">
          <h1>Rank the acts you are considering by audience-taste fit</h1>
          <p className="lead">
            Headliner compares each act&apos;s audience with the artists your regulars already
            follow, using Qloo taste data, and shows the evidence behind every number.
          </p>
        </div>
        <SampleRooms samples={samples} />
        {recorded ? (
          <p className="field-hint">
            This demo runs on recorded Qloo responses, so only artists in those recordings can be
            matched. The sample room always works.
          </p>
        ) : null}
      </div>
      <RoomForm demoMode={recorded} hasSamples={samples.length > 0}>
        <section className="quiet" aria-labelledby="how-heading">
          <h2 id="how-heading">How it works</h2>
          <ol className="steps">
            <li>Describe the room.</li>
            <li>Rank the acts.</li>
            <li>Read the ranked slate and the evidence behind each number.</li>
          </ol>
        </section>
        <section className="quiet" aria-labelledby="get-heading">
          <h2 id="get-heading">What you get</h2>
          <p className="muted">
            A ranked slate. Each act shows Fit, shared tastes, Qloo popularity rank, caveats and the
            Qloo calls behind every number.
          </p>
        </section>
        <DemoLimits recorded={recorded} dailyQlooCalls={displayedDailyQlooCalls()} />
      </RoomForm>
    </main>
  );
}
