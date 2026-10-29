import type { Explanation as ExplanationData } from "@headliner/agent";
import { Icon } from "./Icon";

export interface ExplanationProps extends ExplanationData {
  /** Unique heading id on the page. */
  readonly id?: string;
  readonly heading?: string;
  /** True only for the Suspense fallback: the template shown while the model's text is still being resolved. */
  readonly pending?: boolean;
  /** Slate pages: a closed disclosure (the summary stands in for the h2) with the provenance line always visible. */
  readonly disclosure?: boolean;
}

const SOURCE_LABEL: Record<ExplanationData["source"], { label: string; hint: string }> = {
  llm: { label: "Written from checked facts", hint: "Every figure in this text was checked against this slate before it was shown." },
  template: { label: "Template", hint: "Built from this slate's values by a fixed template; no figure is added." },
};

/**
 * The Explanation block (M3-02). `text` is third-party-influenced (it repeats Qloo names), so it is
 * rendered only as React text nodes: never `dangerouslySetInnerHTML`, never markdown. One line of
 * the text is one paragraph.
 *
 * `data-state` is "pending" on the Suspense fallback and "settled" on the final block. While the stream is
 * in flight the HTML holds both: the visible fallback and the final block inside a hidden node that React
 * swaps in (never two visible regions). Browser tests wait for the settled block to be visible.
 */
export function Explanation({ text, source, id = "explanation-heading", heading = "Explanation", pending = false, disclosure = false }: ExplanationProps) {
  const meta = SOURCE_LABEL[source];
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (disclosure) {
    return (
      <section className="explanation explanation-disclosure" aria-labelledby={id} data-testid="explanation" data-source={source} data-state={pending ? "pending" : "settled"}>
        <details className="disclosure quiet-details">
          <summary id={id}>
            <Icon name="chevron" />
            <span>{heading}</span>
          </summary>
          <div className="stack-sm explanation-text">
            {lines.map((line, index) => (
              <p key={index} dir="auto">
                {line}
              </p>
            ))}
          </div>
        </details>
        <p className="field-hint explanation-source" data-testid="explanation-source">
          <span className="explanation-label">{meta.label}.</span> {meta.hint}
        </p>
      </section>
    );
  }
  return (
    <section className="stack-sm explanation" aria-labelledby={id} data-testid="explanation" data-source={source} data-state={pending ? "pending" : "settled"}>
      <h2 id={id}>{heading}</h2>
      <p className="field-hint explanation-source" data-testid="explanation-source">
        <span className="explanation-label">{meta.label}.</span> {meta.hint}
      </p>
      <div className="stack-sm explanation-text">
        {lines.map((line, index) => (
          <p key={index} dir="auto">
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}
