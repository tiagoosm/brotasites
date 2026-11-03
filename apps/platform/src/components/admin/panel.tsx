// Building blocks of the team panel (E24), in the platform's look (platform-design.md).

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="grid content-start gap-1 rounded-xl border border-input bg-card p-4">
      <dt className="text-[0.8125rem] text-ink-soft">{label}</dt>
      <dd className="text-[1.375rem] font-semibold">{value}</dd>
      {note && <dd className="text-[0.8125rem] text-ink-soft">{note}</dd>}
    </div>
  );
}

export function PanelSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <h2 id={id} className="font-display text-[1.5rem] leading-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

export const STAGES = [
  ["created", "Criado"],
  ["directions", "Direções prontas"],
  ["chosen", "Direção escolhida"],
  ["built", "Site montado"],
  ["approved", "Aprovado"],
  ["paid", "Pago"],
  ["live", "No ar"],
] as const;

export function stageLabel(stage: number | string): string {
  return STAGES[Number(stage)]?.[1] ?? "–";
}

/** A notice for the daily budget past 80% or 100% (never silent). */
export function BudgetNotice({ ratio, alertRatio }: { ratio: number; alertRatio: number }) {
  if (ratio < alertRatio) return null;
  const over = ratio >= 1;
  return (
    <p
      role="status"
      className={`rounded-lg border p-3 text-[0.9375rem] font-semibold ${over ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-pollen/60 bg-pollen/10"}`}
    >
      {over
        ? "O orçamento diário de IA acabou: hoje o motor trabalha sozinho."
        : `O orçamento diário de IA passou de ${Math.round(alertRatio * 100)}%.`}
    </p>
  );
}
