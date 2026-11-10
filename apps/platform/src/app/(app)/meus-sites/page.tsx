import { ArrowRight, ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailConfirmBanner } from "@/components/account/email-banner";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { DiscardSite } from "@/components/dashboard/discard-site";
import { NoticesBell } from "@/components/dashboard/notices";
import { Notice } from "@/components/shared/page-state";
import { CreateSiteButton } from "@/components/site/create-site-button";
import { LinkPending } from "@/components/site/link-pending";
import { Button } from "@/components/ui/button";
import {
  accountNotices,
  type BadgeTone,
  type DashboardSite,
  daysUntil,
  formatDate,
  idleDeadline,
  includedWindow,
  liveAddress,
  milestones,
  noticeHref,
  noticeText,
  siteCard,
  sortSites,
} from "@/lib/dashboard";
import { siteSlotCopy } from "@/lib/limits-copy";
import { type DashboardData, loadDashboard } from "@/lib/server/dashboard";
import { canDiscard, infoFor } from "@/lib/site-status";
import { cn } from "@/lib/utils";

// "Meus sites" (E16 as "Painel", renamed and reshaped in E26): one card per site, with its
// status, what it needs and its one action inside it; the sites waiting on the person come
// first. The account's own notices (confirm the email, complete the profile) are a quiet band
// above the list, only when there is one. Rendered on the server with the person's session
// for each request (no-store, noindex: src/proxy.ts); the proxy already sent people without a
// session to /entrar, and this checks again.

export const metadata: Metadata = { title: "Meus sites", robots: { index: false, follow: false } };

export default async function MySitesPage() {
  const data = await loadDashboard().catch(() => undefined);
  if (data === null) redirect("/entrar?voltar=%2Fmeus-sites");
  const names = new Map(data?.sites.map((site) => [site.id, site.name]));
  const notices =
    data?.notices.map((notice) => ({
      id: notice.id,
      text: noticeText(
        notice.kind,
        notice.siteId ? names.get(notice.siteId) : undefined,
        notice.daysLeft,
      ),
      href: noticeHref(notice),
      date: formatDate(notice.createdAt),
      unread: !notice.readAt,
    })) ?? [];

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-paper">
      <main className="mx-auto grid w-full max-w-[60rem] gap-8 px-5 pt-10 pb-20 sm:px-8">
        {!data ? (
          <Notice
            title="Não foi possível abrir agora"
            text="Suas respostas continuam salvas. Tente de novo em instantes."
          />
        ) : (
          <>
            <Header data={data} notices={notices} />
            <AccountBand data={data} />
            <SiteList sites={data.sites} />
            {data.sites.some((site) => infoFor(site.status).busy) && <AutoRefresh />}
          </>
        )}
      </main>
    </div>
  );
}

function Header({
  data,
  notices,
}: {
  data: DashboardData;
  notices: React.ComponentProps<typeof NoticesBell>["notices"];
}) {
  // One unpaid site in progress per account (E24); the database decides, this only explains.
  const full = data.slots.open >= data.slots.allowed;
  const first = data.fullName.trim().split(" ")[0];
  return (
    <section aria-labelledby="meus-sites" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 id="meus-sites" className="font-display text-[2.5rem] leading-[1.05]">
          Meus sites
        </h1>
        <div className="flex items-center gap-3">
          {data.sites.length > 0 &&
            (full ? (
              <Button variant="outline" size="lg" disabled aria-describedby="vaga-de-site">
                <Plus aria-hidden="true" />
                Criar outro site
              </Button>
            ) : (
              <Button asChild variant="outline" size="lg">
                <Link href="/criar?novo=1">
                  <Plus aria-hidden="true" />
                  Criar outro site
                </Link>
              </Button>
            ))}
          {/* The notices, beside the title (they lived in the old header). */}
          <NoticesBell notices={notices} unread={data.unread} />
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-3 text-[0.9375rem] text-ink-soft">
        <span>{first ? `Olá, ${first}` : "Olá"}</span>
        <span className="break-all">{data.email}</span>
        <Link
          href="/conta"
          className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
        >
          Perfil e segurança
        </Link>
      </p>
      {data.sites.length > 0 && full && (
        <p id="vaga-de-site" className="text-[0.9375rem] text-ink-soft">
          {siteSlotCopy.blocked}{" "}
          {data.slots.openSiteId && (
            <Link
              href={`/meus-sites/${data.slots.openSiteId}`}
              className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
            >
              {siteSlotCopy.openSite}
            </Link>
          )}
        </p>
      )}
    </section>
  );
}

/** The account's own notices, a quiet band above the list; nothing when there is none. */
function AccountBand({ data }: { data: DashboardData }) {
  const items = accountNotices(data);
  if (items.length === 0) return null;
  return (
    <div className="grid gap-3">
      {items.map((item) =>
        item.key === "email" ? (
          <EmailConfirmBanner
            key={item.key}
            account={{
              status: "signed-in",
              userId: data.userId,
              email: data.email,
              emailConfirmed: false,
            }}
          />
        ) : (
          <p
            key={item.key}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-card px-4 py-3 text-[0.9375rem]"
          >
            <span>
              <strong className="font-semibold">{item.title}.</strong>{" "}
              <span className="text-ink-soft">{item.text}</span>
            </span>
            {item.href && (
              <Link
                href={item.href}
                className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
              >
                {item.cta}
              </Link>
            )}
          </p>
        ),
      )}
    </div>
  );
}

function SiteList({ sites }: { sites: DashboardSite[] }) {
  if (sites.length === 0) {
    return (
      <div className="grid gap-3 rounded-xl border border-dashed border-line-strong p-6">
        <h2 className="font-display text-[1.5rem] leading-tight">Crie seu primeiro site</h2>
        <p className="text-[0.9375rem] text-ink-soft">5 passos e você escolhe entre 3 visuais.</p>
        <CreateSiteButton className="justify-self-start" />
      </div>
    );
  }
  return (
    <ul aria-label="Seus sites" className="grid gap-4">
      {sortSites(sites).map((site) => (
        <SiteItem key={site.id} site={site} />
      ))}
    </ul>
  );
}

const dotTone: Record<BadgeTone, string> = {
  "your-turn": "bg-pollen",
  working: "live-dot bg-leaf",
  live: "bg-leaf",
  problem: "bg-destructive",
  quiet: "bg-line-strong",
};

function SiteItem({ site }: { site: DashboardSite }) {
  const info = infoFor(site.status);
  const card = siteCard(site);
  const included = site.status === "live" ? includedWindow(site.publishedAt) : null;
  const address = liveAddress(site.subdomain);
  const steps = milestones(site);
  // Unpaid and waiting on the person: when the cleanup would delete it (E24).
  const deadline = idleDeadline(site);
  const headingId = `site-${site.id}`;
  const statusId = `status-${site.id}`;
  const detailsHref = `/meus-sites/${site.id}`;
  return (
    // A screen reader hears the name, the status, then the action.
    <li
      aria-labelledby={headingId}
      aria-describedby={statusId}
      className={cn(
        "grid gap-4 rounded-xl border border-input bg-card p-5 sm:p-6",
        // Waiting on the person: the one highlight (Von Restorff), a side border and the badge.
        card.yourTurn && "border-l-4 border-l-pollen",
      )}
    >
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* The name is the way to the site's page (E29: no separate "Detalhes" link). */}
          <h2 id={headingId} className="text-[1.25rem] font-semibold break-words">
            <Link
              href={detailsHref}
              className="touch-target underline-offset-4 decoration-1 hover:text-leaf-deep hover:underline"
            >
              {site.name}
              <LinkPending />
            </Link>
          </h2>
          <p
            id={statusId}
            className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[0.875rem] font-semibold"
          >
            <span
              aria-hidden="true"
              className={cn("size-2 rounded-full", dotTone[card.badge.tone])}
            />
            {card.badge.label}
          </p>
        </div>
        <p className="text-[0.9375rem] text-ink-soft">{card.sentence}</p>
      </div>

      {/* One action per card (E29): the site's address is the "Endereço" below, once. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <Button asChild size="lg" variant={card.yourTurn ? "default" : "outline"}>
          <Link href={card.action.href}>
            {card.action.label}
            <span className="sr-only">: {site.name}</span>
            <ArrowRight aria-hidden="true" />
            <LinkPending dot={false} />
          </Link>
        </Button>
      </div>

      {/* The details, quieter, under the action: dates, what publishing included, the
          deletion date of an idle unpaid site, and discarding. */}
      <div className="grid gap-3 border-t border-line pt-4 text-[0.8125rem] text-ink-soft">
        {/* The timeline says more than "Última mudança" (E29: one of the two); a site without
            milestones still shows when it last changed. */}
        {steps.length === 0 && <p>Última mudança em {formatDate(site.updatedAt)}</p>}
        {steps.length > 0 && (
          <ol aria-label="Linha do tempo" className="flex flex-wrap gap-x-4 gap-y-1">
            {steps.map((step) => (
              <li key={step.label}>
                <span className="font-semibold text-ink">{step.label}</span> {formatDate(step.at)}
              </li>
            ))}
          </ol>
        )}
        {included && (
          <dl className="grid gap-x-6 gap-y-1 text-[0.9375rem] text-ink sm:grid-cols-3">
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
        {(deadline || canDiscard(site.status)) && (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            {deadline && (
              <p>
                Guardado até {formatDate(deadline.toISOString())}.{" "}
                {daysUntil(deadline) <= 7
                  ? "Sem novidades, ele será apagado."
                  : "Qualquer mudança renova o prazo."}
              </p>
            )}
            {canDiscard(site.status) && (
              <DiscardSite compact siteId={site.id} siteName={site.name} working={info.busy} />
            )}
          </div>
        )}
      </div>
    </li>
  );
}
