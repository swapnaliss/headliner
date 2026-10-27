import type { ReactNode } from "react";

/**
 * The visible demo-limits note on the intake screen (M2-05, docs/design/screen-room-setup.md).
 * It states the daily per-visitor limit, that saved sample rooms are always available, and that
 * there is no login or CAPTCHA. In recorded-responses mode there is no database and no budget, so
 * it says the limits are off here and names the live demo's limit.
 */
export function DemoLimits({ recorded, dailyQlooCalls }: { recorded: boolean; dailyQlooCalls: number }): ReactNode {
  return (
    <section className="panel" aria-labelledby="limits-heading" data-testid="demo-limits">
      <h2 id="limits-heading">Demo limits</h2>
      {recorded ? (
        <p>
          Daily limits are off in this recorded-responses demo: it makes no live Qloo calls. In the live demo each visitor gets {dailyQlooCalls} live Qloo calls a day.
        </p>
      ) : (
        <p>
          To keep this demo free for everyone, each visitor gets {dailyQlooCalls} live Qloo calls a day. A cold room with 12 candidate acts used about 39 when we tested it, and names already looked up cost nothing. The limit resets at midnight UTC.
        </p>
      )}
      <p>The sample rooms are saved runs. They are always available and use none of those calls. No login, no CAPTCHA.</p>
    </section>
  );
}
