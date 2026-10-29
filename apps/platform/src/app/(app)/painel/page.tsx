import { ArrowRight, ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailConfirmBanner } from "@/components/account/email-banner";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { NoticesBell } from "@/components/dashboard/notices";
import { Notice } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import {
  type DashboardSite,
  formatDate,
  includedWindow,
  liveAddress,
  milestones,
  noticeHref,
  noticeText,
  pendingActions,
  siteAction,
} from "@/lib/dashboard";
import { loadDashboard } from "@/lib/server/dashboard";
import { infoFor } from "@/lib/site-status";
import { cn } from "@/lib/utils";

// The account's home (E16): what needs the person, their sites and the notices. Rendered on the
// server with the person's session for each request (no-store, noindex: src/proxy.ts); the
// proxy already sent people without a session to /entrar, and this checks again.

export const metadata: Metadata = { title: "Painel", robots: { index: false, follow: false } };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ senha?: string }>;
}) {
  const data = await loadDashboard().catch(() => undefined);
  if (data === null) redirect("/entrar?voltar=%2Fpainel");
  const { senha } = await searchParams;
  const names = new Map(data?.sites.map((site) => [site.id, site.name]));
  const notices =
    data?.notices.map((notice) => ({
      id: notice.id,
      text: noticeText(notice.kind, notice.siteId ? names.get(notice.siteId) : undefined),
      href: noticeHref(notice),
      date: formatDate(notice.createdAt),
      unread: !notice.readAt,
    })) ?? [];

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-paper">
      <main className="mx-auto grid w-full max-w-[60rem] gap-12 px-5 pt-10 pb-20 sm:px-8">
        {!data ? (
          <Notice
            title="Não foi possível abrir agora"
            text="Suas respostas continuam salvas. Tente de novo em instantes."
          />
        ) : (
          <>
            <section aria-labelledby="ola" className="grid gap-2">
              {/* The notices, beside the greeting (they lived in the old header). */}
              <div className="flex items-start justify-between gap-4">
                <h1 id="ola" className="font-display text-[2.5rem] leading-[1.05]">
                  {data.fullName.trim() ? `Olá, ${data.fullName.trim().split(" ")[0]}` : "Olá"}
                </h1>
                <NoticesBell notices={notices} unread={data.unread} />
              </div>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.9375rem] text-ink-soft">
                <span className="break-all">{data.email}</span>
                <Link
                  href="/conta"
                  className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
                >
                  Perfil e segurança
                </Link>
              </p>
              {senha === "alterada" && (
                <p
                  role="status"
                  className="mt-2 rounded-lg border border-leaf/30 bg-leaf/5 p-3 text-[0.9375rem]"
                >
                  Senha alterada. Os outros aparelhos vão precisar entrar de novo.
                </p>
              )}
            </section>
            <PendingSection data={data} />
            <SitesSection sites={data.sites} />
            {data.sites.some((site) => infoFor(site.status).busy) && <AutoRefresh />}
          </>
        )}
      </main>
    </div>
  );
}

function PendingSection({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof loadDashboard>>>;
}) {
  const actions = pendingActions(data);
  return (
    <section aria-labelledby="precisa" className="grid gap-4">
      <h2 id="precisa" className="font-display text-[1.75rem] leading-tight">
        Precisa de você
      </h2>
      {actions.length === 0 ? (
        <p className="text-[1.0625rem] text-ink-soft">Tudo em dia.</p>
      ) : (
        <ul className="grid gap-3">
          {actions.map((action) =>
            action.email ? (
              <li key={action.key}>
                <EmailConfirmBanner
                  account={{
                    status: "signed-in",
                    userId: data.userId,
                    email: data.email,
                    emailConfirmed: false,
                  }}
                />
              </li>
            ) : (
              <li
                key={action.key}
                className="grid gap-3 rounded-xl border border-input bg-card p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="grid min-w-0 gap-1">
                  <h3 className="font-semibold break-words">{action.title}</h3>
                  <p className="text-[0.9375rem] text-ink-soft">{action.text}</p>
                </div>
                {action.href && action.cta && (
                  <Button asChild size="lg" className="justify-self-start">
                    <Link href={action.href}>
                      {action.cta}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function SitesSection({ sites }: { sites: DashboardSite[] }) {
  return (
    <section aria-labelledby="seus-sites" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="seus-sites" className="font-display text-[1.75rem] leading-tight">
          Seus sites
        </h2>
        {sites.length > 0 && (
          <Button asChild variant="outline" size="lg">
            <Link href="/criar?novo=1">
              <Plus aria-hidden="true" />
              Criar outro site
            </Link>
          </Button>
        )}
      </div>
      {sites.length === 0 ? (
        <div className="grid gap-3 rounded-xl border border-dashed border-line-strong p-6">
          <h3 className="font-display text-[1.5rem] leading-tight">Crie seu primeiro site</h3>
          <p className="text-[0.9375rem] text-ink-soft">
            Responda sete perguntas sobre o seu negócio e receba 3 direções de visual para escolher.
          </p>
          <Button asChild size="lg" className="justify-self-start">
            <Link href="/criar">
              Criar meu site
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SiteCard({ site }: { site: DashboardSite }) {
  const info = infoFor(site.status);
  const action = siteAction(site);
  const included = site.status === "live" ? includedWindow(site.publishedAt) : null;
  const address = liveAddress(site.subdomain);
  const steps = milestones(site);
  const headingId = `site-${site.id}`;
  return (
    <li
      aria-labelledby={headingId}
      className="grid gap-4 rounded-xl border border-input bg-card p-5"
    >
      <div className="grid gap-1">
        <h3 id={headingId} className="text-[1.25rem] font-semibold break-words">
          {site.name}
        </h3>
        <p className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full",
              info.yourTurn ? "bg-pollen" : info.busy ? "live-dot bg-leaf" : "bg-line-strong",
            )}
          />
          <span className="font-semibold">{info.label}</span>
          {info.yourTurn && <span className="tag text-stem">Sua vez</span>}
        </p>
        <p className="text-[0.9375rem] text-ink-soft">
          {site.statusMessage && site.status === "needs_attention" ? site.statusMessage : info.text}
        </p>
        <p className="text-[0.8125rem] text-ink-soft">
          Última mudança em {formatDate(site.updatedAt)}
        </p>
      </div>

      {steps.length > 0 && (
        <ol
          aria-label="Linha do tempo"
          className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-ink-soft"
        >
          {steps.map((step) => (
            <li key={step.label}>
              <span className="font-semibold text-ink">{step.label}</span> {formatDate(step.at)}
            </li>
          ))}
        </ol>
      )}

      {included && (
        <dl className="grid gap-x-6 gap-y-1 text-[0.9375rem] sm:grid-cols-3">
          {address && (
            <div>
              <dt className="text-[0.8125rem] text-ink-soft">Endereço</dt>
              <dd>
                <a
                  href={`https://${address}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-11 items-center gap-1 font-semibold break-all text-leaf-deep underline underline-offset-4"
                >
                  {address}
                  <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                  <span className="sr-only">(abre em outra aba)</span>
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[0.8125rem] text-ink-soft">Hospedagem incluída até</dt>
            <dd className="font-semibold">{included.hostingUntil}</dd>
          </div>
          <div>
            <dt className="text-[0.8125rem] text-ink-soft">Alterações incluídas</dt>
            <dd className="font-semibold">
              {included.adjustmentDaysLeft > 0
                ? `${included.adjustmentDaysLeft} ${included.adjustmentDaysLeft === 1 ? "dia restante" : "dias restantes"}`
                : "Período encerrado"}
            </dd>
          </div>
        </dl>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Button asChild size="lg" variant={info.yourTurn ? "default" : "outline"}>
          <Link href={action.href}>
            {action.label}
            <span className="sr-only">: {site.name}</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        {site.status === "live" && address && (
          <a
            href={`https://${address}`}
            target="_blank"
            rel="noopener"
            className="touch-target inline-flex items-center gap-1 text-[0.9375rem] font-semibold text-leaf-deep underline underline-offset-4"
          >
            Ver o site
            <span className="sr-only">{site.name}</span>
            <ExternalLink aria-hidden="true" className="size-4" />
            <span className="sr-only">(abre em outra aba)</span>
          </a>
        )}
        {action.href !== `/meus-sites/${site.id}` && (
          <Link
            href={`/meus-sites/${site.id}`}
            className="touch-target text-[0.9375rem] font-semibold text-leaf-deep underline underline-offset-4"
          >
            Detalhes<span className="sr-only"> de {site.name}</span>
          </Link>
        )}
      </div>
    </li>
  );
}
