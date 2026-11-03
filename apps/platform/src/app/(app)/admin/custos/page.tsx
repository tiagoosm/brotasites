"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bars } from "@/components/admin/bars";
import { BudgetNotice, PanelSection, Stat } from "@/components/admin/panel";
import { Loading, Notice } from "@/components/shared/page-state";
import type { AiBudget } from "@/lib/admin/budget";
import { adminGet } from "@/lib/admin/client";
import {
  formatBrlEstimate,
  formatCount,
  formatUsd,
  NO_DATA,
  rateNote,
  shortDay,
} from "@/lib/admin/format";
import { infoFor } from "@/lib/site-status";

// Team panel, costs of the last 30 days (E24): per day, task and model, the sites and accounts
// that cost most, paid versus unpaid, and how long the jobs take.

interface Costs {
  byDay: { day: string; usd: number; calls: number }[];
  byTask: { task: string; usd: number; calls: number }[];
  byModel: {
    model: string;
    usd: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
  }[];
  topSites: { siteId: string; name: string | null; status: string; usd: number }[];
  topAccounts: { userId: string; email: string; usd: number }[];
  perSite: {
    sites: number;
    average: number | null;
    median: number | null;
    paidUsd: number;
    unpaidUsd: number;
    paidSites: number;
    unpaidSites: number;
  };
  removedUsd: number;
  jobs: { kind: string; runs: number; averageSeconds: number; maxSeconds: number }[];
}

const taskLabels: Record<string, string> = {
  directions: "Direções",
  copy: "Texto",
  rewrite: "Texto refeito",
  review: "Revisor",
};
const jobLabels: Record<string, string> = {
  directions: "Direções",
  build: "Montagem",
  publish: "Publicação",
};

export default function CostsPage() {
  const [data, setData] = useState<{
    costs: Costs;
    today: { spentUsd: number } | null;
    budget: AiBudget;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    document.title = "Custos · BrotaSites";
    adminGet<typeof data>("/api/admin/costs").then(setData, (caught: Error) =>
      setError(caught.message),
    );
  }, []);
  if (error) return <Notice title="Não foi possível abrir os custos" text={error} />;
  if (!data) return <Loading />;
  const { costs, budget } = data;
  const spent = Number(data.today?.spentUsd ?? 0);
  const ratio = budget.dailyBudgetUsd > 0 ? spent / budget.dailyBudgetUsd : 0;
  const empty = costs.byDay.length === 0;

  return (
    <div className="grid gap-10">
      <h1 className="font-display text-[2.5rem] leading-[1.05]">Custos dos últimos 30 dias</h1>
      <BudgetNotice ratio={ratio} alertRatio={budget.alertRatio} />
      {empty ? (
        <p className="text-ink-soft">Nenhuma chamada à IA nos últimos 30 dias: {NO_DATA}.</p>
      ) : (
        <>
          <PanelSection id="por-dia" title="Por dia">
            <Bars
              values={costs.byDay.map((row) => Number(row.usd))}
              labels={costs.byDay.map((row) => shortDay(row.day))}
            />
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-left text-[0.9375rem]">
                <thead className="text-[0.8125rem] text-ink-soft">
                  <tr>
                    <th className="py-2 font-normal">Dia</th>
                    <th className="py-2 font-normal">Chamadas</th>
                    <th className="py-2 font-normal">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.byDay.map((row) => (
                    <tr key={row.day} className="border-t border-line">
                      <td className="py-2">{shortDay(row.day)}</td>
                      <td className="py-2">{formatCount(row.calls)}</td>
                      <td className="py-2 font-semibold">{formatUsd(row.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[0.8125rem] text-ink-soft">{rateNote}</p>
          </PanelSection>

          <PanelSection id="por-site" title="Por site">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Stat label="Média por site" value={formatUsd(costs.perSite.average)} />
              <Stat label="Mediana por site" value={formatUsd(costs.perSite.median)} />
              <Stat
                label="Sites pagos"
                value={formatUsd(costs.perSite.paidUsd)}
                note={`${formatCount(costs.perSite.paidSites)} sites`}
              />
              <Stat
                label="Sites não pagos"
                value={formatUsd(costs.perSite.unpaidUsd)}
                note={`${formatCount(costs.perSite.unpaidSites)} sites · ${formatBrlEstimate(costs.perSite.unpaidUsd)}`}
              />
              <Stat label="Sites já apagados" value={formatUsd(costs.removedUsd)} />
            </dl>
          </PanelSection>

          <PanelSection id="por-tarefa" title="Por tarefa e por modelo">
            <ul className="grid gap-1 text-[0.9375rem]">
              {costs.byTask.map((row) => (
                <li key={row.task}>
                  {taskLabels[row.task] ?? row.task}: <strong>{formatUsd(row.usd)}</strong> (
                  {formatCount(row.calls)} chamadas)
                </li>
              ))}
            </ul>
            <ul className="grid gap-1 text-[0.9375rem]">
              {costs.byModel.map((row) => (
                <li key={row.model}>
                  <span className="tag">{row.model}</span>: <strong>{formatUsd(row.usd)}</strong>,{" "}
                  {formatCount(row.inputTokens)} tokens de entrada e {formatCount(row.outputTokens)}{" "}
                  de saída
                </li>
              ))}
            </ul>
          </PanelSection>

          <PanelSection id="maiores" title="Os que mais gastaram">
            <div className="grid gap-6 md:grid-cols-2">
              <ol className="grid gap-1 text-[0.9375rem]">
                {costs.topSites.map((row) => (
                  <li key={row.siteId}>
                    <Link
                      href={`/admin/sites/${row.siteId}`}
                      className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
                    >
                      {row.name ?? "Site sem nome"}
                    </Link>{" "}
                    · {infoFor(row.status).label} · {formatUsd(row.usd)}
                  </li>
                ))}
              </ol>
              <ol className="grid gap-1 text-[0.9375rem]">
                {costs.topAccounts.map((row) => (
                  <li key={row.userId}>
                    <Link
                      href={`/admin/contas/${row.userId}`}
                      className="touch-target font-semibold break-all text-leaf-deep underline underline-offset-4"
                    >
                      {row.email}
                    </Link>{" "}
                    · {formatUsd(row.usd)}
                  </li>
                ))}
              </ol>
            </div>
          </PanelSection>
        </>
      )}

      <PanelSection id="maquina" title="Tempo de máquina">
        {costs.jobs.length === 0 ? (
          <p className="text-ink-soft">{NO_DATA}.</p>
        ) : (
          <ul className="grid gap-1 text-[0.9375rem]">
            {costs.jobs.map((row) => (
              <li key={row.kind}>
                {jobLabels[row.kind] ?? row.kind}: média de {row.averageSeconds}s, máximo de{" "}
                {row.maxSeconds}s ({formatCount(row.runs)} vezes)
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </div>
  );
}
