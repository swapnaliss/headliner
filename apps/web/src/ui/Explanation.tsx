import type { Explanation as ExplanationData } from "@headliner/agent";

export interface ExplanationProps extends ExplanationData {
  /** Unique heading id on the page. */
  readonly id?: string;
  readonly heading?: string;
}

const SOURCE_LABEL: Record<ExplanationData["source"], { label: string; hint: string }> = {
  llm: { label: "Written from checked facts", hint: "Every figure in this text was checked against this slate before it was shown." },
  template: { label: "Template", hint: "Built from this slate's values by a fixed template; no figure is added." },
};

/**
 * The Explanation block (M3-02). `text` is third-party-influenced (it repeats Qloo names), so it is
 * rendered only as React text nodes: never `dangerouslySetInnerHTML`, never markdown. One line of
 * the text is one paragraph.
 */
export function Explanation({ text, source, id = "explanation-heading", heading = "Explanation" }: ExplanationProps) {
  const meta = SOURCE_LABEL[source];
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  return (
    <section className="stack-sm explanation" aria-labelledby={id} data-testid="explanation" data-source={source}>
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
