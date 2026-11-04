"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PanelSection, Stat } from "@/components/admin/panel";
import { TeamAction } from "@/components/admin/team-action";
import { Loading, Notice } from "@/components/shared/page-state";
import type { AiBudget } from "@/lib/admin/budget";
import { adminGet } from "@/lib/admin/client";
import { dateTime, formatCount, formatUsd } from "@/lib/admin/format";
import { infoFor } from "@/lib/site-status";

// Team panel, limits and actions (E24): the values in force and what the cleanup will remove in
// the next 7 days (its dry run), with the actions the team may take. The AI's budget and the AI
// itself are not changed here: they are the owner's, in the environment.

interface Data {
  database: {
    freeDirectionRounds: number;
    extraRoundWaitSeconds: number;
    openSitesPerAccount: number;
    idleDays: number;
    syncedAt: string;
    deletingWithin7Days: number;
    slotGrants: number;
  };
  config: {
    freeDirectionRounds: number;
    extraRoundWaitMinutes: number;
    openSitesPerAccount: number;
    idleDaysBeforeDeletion: number;
    deletionWarningDays: number[];
  };
  budget: AiBudget;
  upcoming: { siteId: string; status: string; deadline: string }[];
}

export default function LimitsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    adminGet<Data>("/api/admin/limits").then(setData, (caught: Error) => setError(caught.message));
  }, []);
  useEffect(() => {
    document.title = "Limites · BrotaSites";
    load();
  }, [load]);
  if (error) return <Notice title="Não foi possível abrir os limites" text={error} />;
  if (!data) return <Loading />;
  const { config, database, budget } = data;

  return (
    <div className="grid gap-10">
      <h1 className="font-display text-[2.5rem] leading-[1.05]">Limites</h1>

      <PanelSection id="vigentes" title="Valores em vigor">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Rodadas de direções grátis por site"
            value={String(config.freeDirectionRounds)}
          />
          <Stat
            label="Depois delas, 1 rodada a cada"
            value={`${config.extraRoundWaitMinutes} min`}
          />
          <Stat
            label="Sites não pagos em andamento por conta"
            value={String(config.openSitesPerAccount)}
          />
          <Stat
            label="Apaga sites não pagos parados há"
            value={`${config.idleDaysBeforeDeletion} dias`}
            note={`Avisos no painel ${config.deletionWarningDays.join(" e ")} ${config.deletionWarningDays.length > 1 ? "dias" : "dia"} antes.`}
          />
          <Stat
            label="Orçamento diário de IA"
            value={formatUsd(budget.dailyBudgetUsd)}
            note={`Alerta em ${Math.round(budget.alertRatio * 100)}%. Muda só nas variáveis de ambiente.`}
          />
          <Stat
            label="Rodadas de IA por dia"
            value={`${budget.roundsPerSitePerDay} por site`}
            note={`${budget.roundsPerAccountPerDay} por conta`}
          />
          <Stat label="Exceções de vaga em vigor" value={formatCount(database.slotGrants)} />
        </dl>
        <p className="text-[0.8125rem] text-ink-soft">
          Valores de config/limits.ts. O banco recebeu os últimos em {dateTime(database.syncedAt)}.
        </p>
      </PanelSection>

      <PanelSection id="limpeza" title="Limpeza dos próximos 7 dias">
        <p className="text-[0.9375rem]">
          Serão apagados nos próximos 7 dias:{" "}
          <strong>
            {formatCount(database.deletingWithin7Days)}{" "}
            {database.deletingWithin7Days === 1 ? "site" : "sites"}
          </strong>
          .
        </p>
        {data.upcoming.length > 0 && (
          <ul className="grid gap-4">
            {data.upcoming.map((row) => (
              <li
                key={row.siteId}
                className="grid gap-2 rounded-xl border border-input bg-card p-4"
              >
                <Link
                  href={`/admin/sites/${row.siteId}`}
                  className="touch-target justify-self-start font-semibold text-leaf-deep underline underline-offset-4"
                >
                  {infoFor(row.status).label} · apagado em {dateTime(row.deadline)}
                </Link>
                <TeamAction
                  action="extend_cleanup"
                  target={{ siteId: row.siteId }}
                  days={14}
                  label="Adiar 14 dias"
                  confirmLabel="Confirmar o adiamento"
                  onDone={load}
                />
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </div>
  );
}
