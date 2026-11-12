"use client";

import { useEffect, useState } from "react";
import { BudgetBar } from "@/components/admin/bars";
import { BudgetNotice, PanelSection, STAGES, Stat, stageLabel } from "@/components/admin/panel";
import { Loading, Notice } from "@/components/shared/page-state";
import type { AiBudget } from "@/lib/admin/budget";
import { adminGet } from "@/lib/admin/client";
import {
  formatBrlEstimate,
  formatCount,
  formatPercent,
  formatUsd,
  NO_DATA,
  passRate,
  rateNote,
} from "@/lib/admin/format";
import { cn } from "@/lib/utils";

// Team panel, overview (E24): accounts, the funnel, abandoned sites and the AI's cost.

type Funnel = Record<(typeof STAGES)[number][0], number>;
interface Period {
  accounts: number;
  confirmed: number;
  funnel: Funnel;
  costUsd: number;
  aiCalls: number;
  paidSites: number;
  costPerSite: number | null;
  costPerPaidSite: number | null;
}
interface Overview {
  "7": Period;
  "30": Period;
  all: Period;
  abandoned: Record<string, number>;
  today: { day: string; spentUsd: number };
}

const periods = [
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["all", "Sempre"],
] as const;

/** E34: whether generation is set up, and the jobs waiting past the limit. */
interface Generation {
  enforced: boolean;
  ready: boolean;
  missing: string[];
  stuckJobs: number;
  stuckMinutes: number;
  /** E37: a job "running" with no process left after this long also counts as stuck. */
  stuckRunningMinutes?: number;
}

export default function OverviewPage() {
  const [data, setData] = useState<{
    overview: Overview;
    budget: AiBudget;
    generation?: Generation;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<(typeof periods)[number][0]>("30");
  useEffect(() => {
    document.title = "Visão geral · BrotaSites";
    adminGet<{ overview: Overview; budget: AiBudget; generation?: Generation }>(
      "/api/admin/overview",
    ).then(setData, (caught: Error) => setError(caught.message));
  }, []);
  if (error) return <Notice title="Não foi possível abrir a visão geral" text={error} />;
  if (!data) return <Loading />;
  const { overview, budget, generation } = data;
  const now = overview[period];
  const funnel = now.funnel;
  const spent = Number(overview.today.spentUsd);
  const ratio = budget.dailyBudgetUsd > 0 ? spent / budget.dailyBudgetUsd : 0;
  const abandoned = Object.entries(overview.abandoned);

  return (
    <div className="grid gap-10">
      {generation && <GenerationNotice generation={generation} />}
      <header className="grid gap-4">
        <h1 className="font-display text-[2.5rem] leading-[1.05]">Visão geral</h1>
        <div role="tablist" aria-label="Período" className="flex flex-wrap gap-2">
          {periods.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={period === key}
              onClick={() => setPeriod(key)}
              className={cn(
                "inline-flex h-11 items-center rounded-full border px-4 text-[0.9375rem]",
                period === key
                  ? "border-leaf bg-leaf-wash font-semibold text-leaf-deep"
                  : "border-input bg-card",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <PanelSection id="hoje" title="Orçamento de IA hoje">
        <BudgetNotice ratio={ratio} alertRatio={budget.alertRatio} />
        <BudgetBar
          spentUsd={spent}
          budgetUsd={budget.dailyBudgetUsd}
          alertRatio={budget.alertRatio}
        />
        <p className="text-[0.9375rem]">
          {formatUsd(spent)} de {formatUsd(budget.dailyBudgetUsd)} ({formatPercent(ratio)}). Alerta
          em {formatPercent(budget.alertRatio)}.
        </p>
      </PanelSection>

      <PanelSection id="numeros" title="Números do período">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat label="Contas criadas" value={formatCount(now.accounts)} />
          <Stat label="Com e-mail confirmado" value={formatCount(now.confirmed)} />
          <Stat label="Sites criados" value={formatCount(funnel.created)} />
          <Stat
            label="Custo de IA"
            value={now.aiCalls > 0 ? formatUsd(now.costUsd) : NO_DATA}
            note={now.aiCalls > 0 ? formatBrlEstimate(now.costUsd) : undefined}
          />
          <Stat
            label="Custo por site criado"
            value={formatUsd(now.aiCalls > 0 ? now.costPerSite : null)}
          />
          <Stat
            label="Custo por site pago"
            value={formatUsd(now.costPerPaidSite)}
            note="O custo de todos os sites dividido pelos pagos."
          />
        </dl>
        <p className="text-[0.8125rem] text-ink-soft">{rateNote}</p>
      </PanelSection>

      <PanelSection id="funil" title="Funil">
        {funnel.created === 0 ? (
          <p className="text-ink-soft">Nenhum site criado no período: {NO_DATA}.</p>
        ) : (
          <table className="w-full text-left text-[0.9375rem]">
            <thead className="text-[0.8125rem] text-ink-soft">
              <tr>
                <th className="py-2 font-normal">Fase</th>
                <th className="py-2 font-normal">Sites</th>
                <th className="py-2 font-normal">Passaram da anterior</th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map(([key, label], index) => (
                <tr key={key} className="border-t border-line">
                  <td className="py-2">{label}</td>
                  <td className="py-2 font-semibold">{formatCount(funnel[key])}</td>
                  <td className="py-2">
                    {index === 0
                      ? "–"
                      : passRate(funnel[STAGES[index - 1]?.[0] ?? "created"], funnel[key])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PanelSection>

      <PanelSection id="abandonados" title="Abandonados">
        <p className="text-[0.9375rem] text-ink-soft">
          Não pagos e sem nenhuma ação da pessoa há mais de 7 dias, pela última fase alcançada.
        </p>
        {abandoned.length === 0 ? (
          <p>Nenhum agora.</p>
        ) : (
          <ul className="grid gap-1 text-[0.9375rem]">
            {abandoned.map(([stage, count]) => (
              <li key={stage}>
                {stageLabel(stage)}: <span className="font-semibold">{formatCount(count)}</span>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </div>
  );
}

/**
 * E34: the creation of sites is closed until generation is set up; the names of what is missing
 * (never values) and where to read the steps. Jobs waiting past the limit, when there are any.
 */
function GenerationNotice({ generation }: { generation: Generation }) {
  const closed = generation.enforced && !generation.ready;
  if (!closed && generation.stuckJobs === 0) return null;
  return (
    <div
      role="status"
      className="grid gap-2 rounded-lg border border-pollen/60 bg-pollen/10 p-4 text-[0.9375rem]"
    >
      {closed && (
        <>
          <p className="font-semibold">
            A criação de sites está fechada: a geração ainda não está configurada.
          </p>
          <p>
            Falta na Vercel:{" "}
            {generation.missing.map((name, index) => (
              <span key={name}>
                {index > 0 && ", "}
                <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[0.8125rem]">
                  {name}
                </code>
              </span>
            ))}
            . Os passos estão em{" "}
            <code className="font-mono text-[0.8125rem]">docs/launch-status.md</code>.
          </p>
        </>
      )}
      {generation.stuckJobs > 0 && (
        <p className="font-semibold">
          {generation.stuckJobs === 1
            ? "1 geração está parada"
            : `${generation.stuckJobs} gerações estão paradas`}
          {`: na fila há mais de ${generation.stuckMinutes} minutos ou rodando há mais de ${
            generation.stuckRunningMinutes ?? 45
          } minutos sem terminar.`}
        </p>
      )}
    </div>
  );
}
