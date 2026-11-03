"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PanelSection, Stat } from "@/components/admin/panel";
import { TeamAction } from "@/components/admin/team-action";
import { Loading, Notice } from "@/components/shared/page-state";
import { adminGet } from "@/lib/admin/client";
import { dateTime, formatUsd } from "@/lib/admin/format";
import { infoFor } from "@/lib/site-status";

// Team panel, one account (E24): the minimum for support. The database logs each opening.

interface Account {
  userId: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  openSites: number;
  allowedOpenSites: number;
  slotGrant: { extra: number; reason: string; grantedAt: string } | null;
  sites: {
    siteId: string;
    name: string | null;
    status: string;
    paid: boolean;
    costUsd: number;
    rounds: number;
    freeRounds: number;
    nextRoundAt: string | null;
    deletesAt: string | null;
  }[];
  events: { siteId: string; kind: string; message: string; at: string }[];
}

export default function AccountPage() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    adminGet<Account>(`/api/admin/accounts/${id}`).then(setAccount, (caught: Error) =>
      setError(caught.message),
    );
  }, [id]);
  useEffect(() => {
    document.title = "Conta · BrotaSites";
    load();
  }, [load]);

  if (error) return <Notice title="Não foi possível abrir a conta" text={error} />;
  if (!account) return <Loading />;

  return (
    <div className="grid gap-10">
      <header className="grid gap-2">
        <Link
          href="/admin/contas"
          className="touch-target justify-self-start text-sm font-semibold text-leaf-deep underline-offset-4 hover:underline"
        >
          ← Contas
        </Link>
        <h1 className="font-display text-[2.25rem] leading-[1.05] break-all">{account.email}</h1>
        <p className="text-[0.8125rem] text-ink-soft">
          Esta abertura fica registrada no log da equipe.
        </p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-3">
        <Stat label="Nome" value={account.name || "–"} />
        <Stat label="Conta criada" value={dateTime(account.createdAt)} />
        <Stat label="Último acesso" value={dateTime(account.lastSignInAt)} />
        <Stat label="E-mail" value={account.confirmed ? "Confirmado" : "Não confirmado"} />
        <Stat
          label="Sites em andamento"
          value={`${account.openSites} de ${account.allowedOpenSites}`}
          note={account.slotGrant ? `Exceção: ${account.slotGrant.reason}` : undefined}
        />
      </dl>

      <PanelSection id="sites" title="Sites">
        {account.sites.length === 0 ? (
          <p className="text-ink-soft">Nenhum site.</p>
        ) : (
          <ul className="grid gap-3">
            {account.sites.map((site) => (
              <li
                key={site.siteId}
                className="grid gap-1 rounded-xl border border-input bg-card p-4"
              >
                <Link
                  href={`/admin/sites/${site.siteId}`}
                  className="touch-target justify-self-start font-semibold text-leaf-deep underline underline-offset-4"
                >
                  {site.name ?? "Site sem nome"}
                </Link>
                <span className="text-sm text-ink-soft">
                  {[
                    infoFor(site.status).label,
                    site.paid ? "pago" : "não pago",
                    `IA ${formatUsd(site.costUsd)}`,
                    `${site.rounds} de ${site.freeRounds} rodadas grátis`,
                    site.nextRoundAt && `próxima rodada ${dateTime(site.nextRoundAt)}`,
                    site.deletesAt && `apagado em ${dateTime(site.deletesAt)} sem novidades`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection id="excecao" title="Exceção de vaga">
        <TeamAction
          action="grant_site_slot"
          target={{ userId: account.userId }}
          label="Liberar mais 1 site em andamento"
          confirmLabel="Confirmar a exceção"
          onDone={load}
        />
      </PanelSection>

      <PanelSection id="eventos" title="Eventos recentes">
        {account.events.length === 0 ? (
          <p className="text-ink-soft">Nenhum evento.</p>
        ) : (
          <ol className="grid gap-2 border-l border-line-strong pl-5 text-[0.9375rem]">
            {account.events.map((event) => (
              <li key={`${event.siteId}-${event.at}-${event.kind}`} className="grid">
                <span>{event.message}</span>
                <span className="text-[0.8125rem] text-ink-soft">{dateTime(event.at)}</span>
              </li>
            ))}
          </ol>
        )}
      </PanelSection>
    </div>
  );
}
