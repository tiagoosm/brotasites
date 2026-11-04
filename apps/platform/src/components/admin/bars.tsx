// A small bar chart in plain SVG (E24): no chart library. The table next to it carries the same
// numbers for screen readers and for exact values, so the chart is aria-hidden.

export function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(0, ...values);
  if (max <= 0) return null;
  const width = 600;
  const height = 140;
  const gap = 2;
  const bar = values.length > 0 ? width / values.length - gap : 0;
  return (
    <svg
      viewBox={`0 0 ${width} ${height + 18}`}
      aria-hidden="true"
      className="h-auto w-full text-leaf"
      preserveAspectRatio="none"
    >
      {values.map((value, index) => {
        const h = Math.max(1, (value / max) * height);
        return (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: one bar per day, in order
            key={index}
            x={index * (bar + gap)}
            y={height - h}
            width={bar}
            height={h}
            rx={2}
            fill="currentColor"
          />
        );
      })}
      <text x={0} y={height + 14} fontSize={11} fill="currentColor" className="text-ink-soft">
        {labels[0]}
      </text>
      <text
        x={width}
        y={height + 14}
        fontSize={11}
        textAnchor="end"
        fill="currentColor"
        className="text-ink-soft"
      >
        {labels[labels.length - 1]}
      </text>
    </svg>
  );
}

/** Today's spend against the budget, with the 80% mark. */
export function BudgetBar({
  spentUsd,
  budgetUsd,
  alertRatio,
}: {
  spentUsd: number;
  budgetUsd: number;
  alertRatio: number;
}) {
  const ratio = budgetUsd > 0 ? Math.min(1, spentUsd / budgetUsd) : 0;
  const color =
    spentUsd >= budgetUsd ? "bg-destructive" : ratio >= alertRatio ? "bg-pollen" : "bg-leaf";
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
      <div className={`h-full ${color}`} style={{ width: `${ratio * 100}%` }} />
      <div
        className="absolute top-0 h-full w-0.5 bg-ink"
        style={{ left: `${alertRatio * 100}%` }}
      />
    </div>
  );
}
