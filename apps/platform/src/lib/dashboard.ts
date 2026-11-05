import { formSteps12, knownSteps } from "@brotasites/schema/v1.2";
import { limits } from "@/config/limits";
import { pricing } from "@/config/pricing";
import { infoFor } from "./site-status";
import { SITES_DOMAIN } from "./site-url";

// The dashboard (/painel, E16): what needs the person, their sites and the notices. Pure
// functions over what the server reads with the person's session; the page only renders them.

export interface DashboardSite {
  id: string;
  name: string;
  status: string;
  subdomain: string | null;
  statusMessage: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  publishedAt: string | null;
  /** The form steps already answered (drafts). */
  completed: string[];
  /** The first time the 3 directions were ready and the site was built (site_events). */
  directionsReadyAt: string | null;
  builtAt: string | null;
  /** The person's last action on the site and a later date the team set (E24 cleanup). */
  lastActivityAt?: string | null;
  keepUntil?: string | null;
}

const ZONE = "America/Sao_Paulo";

/** The calendar day of an instant in Brazil (São Paulo), as [year, month 1-12, day]. */
export function brazilDay(instant: Date): [number, number, number] {
  const text = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  const [year, month, day] = text.split("-").map(Number) as [number, number, number];
  return [year, month, day];
}

const dayNumber = ([year, month, day]: [number, number, number]) =>
  Math.round(Date.UTC(year, month - 1, day) / 86_400_000);

/** "05/11/2027". */
export function formatDay([year, month, day]: [number, number, number]): string {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/** The day a number of months later; the 31st becomes the month's last day when it is shorter. */
export function addMonths(
  [year, month, day]: [number, number, number],
  months: number,
): [number, number, number] {
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return [nextYear, nextMonth, Math.min(day, lastDay)];
}

export interface Included {
  /** Hosting included until this day (pricing.hostingMonths after publishing), "dd/mm/aaaa". */
  hostingUntil: string;
  hostingEnded: boolean;
  /** Days left of the changes included after publishing (pricing.adjustmentsDays). */
  adjustmentDaysLeft: number;
}

/** What publishing included, counted in Brazil's calendar days; null before publishing. */
export function includedWindow(
  publishedAt: string | null,
  now: Date = new Date(),
): Included | null {
  if (!publishedAt) return null;
  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return null;
  const start = brazilDay(published);
  const today = dayNumber(brazilDay(now));
  const until = addMonths(start, pricing.hostingMonths);
  const elapsed = today - dayNumber(start);
  return {
    hostingUntil: formatDay(until),
    hostingEnded: today > dayNumber(until),
    adjustmentDaysLeft: Math.max(0, pricing.adjustmentsDays - Math.max(0, elapsed)),
  };
}

/** The public address of a published site ("padaria-do-ze.<BASE_DOMAIN>"). */
export function liveAddress(subdomain: string | null): string | null {
  return subdomain ? `${subdomain}.${SITES_DOMAIN}` : null;
}

/**
 * The first form step still unanswered: where "Continuar" opens a draft. With the 5 steps
 * answered but not sent yet, the last one, where the answers are sent. Old slugs of the former
 * 7-step form ("direcao", "endereco") are ignored.
 */
export function resumeStep(completed: readonly string[]): {
  slug: string;
  title: string;
  number: number;
} {
  const known = knownSteps(completed);
  const index = formSteps12.findIndex((item) => !known.includes(item.slug));
  const at = index === -1 ? formSteps12.length - 1 : index;
  const step = formSteps12[at] ?? formSteps12[0];
  return { slug: step.slug, title: step.title, number: at + 1 };
}

/** "passo 2 de 5 (Marca e sensação)". */
export function resumeLabel(completed: readonly string[]): string {
  const step = resumeStep(completed);
  return `passo ${step.number} de ${formSteps12.length} (${step.title})`;
}

const siteHref = (id: string) => `/meus-sites/${id}`;

/** The one button for the site's moment. */
export function siteAction(site: DashboardSite): { label: string; href: string } {
  switch (site.status) {
    case "draft":
      return { label: "Continuar", href: `/criar/${site.id}/${resumeStep(site.completed).slug}` };
    case "awaiting_direction_choice":
      return { label: "Escolher direção", href: siteHref(site.id) };
    case "awaiting_approval":
      return { label: "Publicar", href: `${siteHref(site.id)}/publicar` };
    case "live":
    case "grace":
      return { label: "Baixar o site", href: `${siteHref(site.id)}#baixar` };
    default:
      return { label: "Ver detalhes", href: siteHref(site.id) };
  }
}

// The idle cleanup (E24) -----------------------------------------------------------------------

/**
 * Statuses where an unpaid site waits on the person: only these are ever deleted for being idle.
 * Generating, building and in review wait on us; paid, live, suspended and grace never go.
 */
export const IDLE_STATUSES = [
  "draft",
  "awaiting_direction_choice",
  "awaiting_approval",
  "needs_attention",
] as const;

/**
 * When an idle site would be deleted: idleDays after the person's last action, or later if the
 * team extended it. Null when the rule does not apply (wrong status, no date: in doubt, never).
 * The database applies the same rule (private.idle_deadline, private.idle_candidate).
 */
export function idleDeadline(
  site: Pick<DashboardSite, "status" | "lastActivityAt" | "keepUntil">,
  idleDays: number = limits.idleDaysBeforeDeletion,
): Date | null {
  if (!(IDLE_STATUSES as readonly string[]).includes(site.status) || !site.lastActivityAt) {
    return null;
  }
  const last = new Date(site.lastActivityAt);
  if (Number.isNaN(last.getTime())) return null;
  const deadline = new Date(last.getTime() + idleDays * 86_400_000);
  const keep = site.keepUntil ? new Date(site.keepUntil) : null;
  return keep && !Number.isNaN(keep.getTime()) && keep > deadline ? keep : deadline;
}

/** Whole days left before the deletion, counted in Brazil's calendar (0 = today). */
export function daysUntil(deadline: Date, now: Date = new Date()): number {
  return Math.max(0, dayNumber(brazilDay(deadline)) - dayNumber(brazilDay(now)));
}

export interface Milestone {
  label: string;
  at: string;
}

/** The milestones that already happened, oldest first. */
export function milestones(site: DashboardSite): Milestone[] {
  const all: [string, string | null][] = [
    ["Criado", site.createdAt],
    ["Direções prontas", site.directionsReadyAt],
    ["Em revisão", site.builtAt],
    ["Aprovado", site.approvedAt],
    ["Publicado", site.publishedAt],
  ];
  return all
    .filter((item): item is [string, string] => Boolean(item[1]))
    .map(([label, at]) => ({ label, at }));
}

/** "29/10/2026", in Brazil's calendar. */
export function formatDate(at: string): string {
  return formatDay(brazilDay(new Date(at)));
}

// What needs the person ------------------------------------------------------------------------

export interface PendingAction {
  key: string;
  title: string;
  text: string;
  href?: string;
  cta?: string;
  /** The email's own banner (with the resend button) is shown instead of a link. */
  email?: boolean;
}

/** Lower comes first. */
const urgency: Record<string, number> = {
  needs_attention: 1,
  grace: 2,
  awaiting_direction_choice: 3,
  awaiting_approval: 4,
  draft: 5,
};

/** The pending actions, most urgent first. Texts come from statusInfo (lib/site-status.ts). */
export function pendingActions(input: {
  emailConfirmed: boolean;
  fullName: string;
  sites: DashboardSite[];
}): PendingAction[] {
  const actions: PendingAction[] = [];
  if (!input.emailConfirmed) {
    actions.push({
      key: "email",
      title: "Confirme o seu e-mail",
      text: "Para ver as 3 direções e para pagar, toque no link que enviamos.",
      email: true,
    });
  }
  const sites = input.sites
    .filter((site) => site.status in urgency)
    .sort(
      (a, b) =>
        (urgency[a.status] as number) - (urgency[b.status] as number) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  for (const site of sites) {
    const info = infoFor(site.status);
    const action = siteAction(site);
    const text =
      site.status === "draft"
        ? `Continue de onde parou: ${resumeLabel(site.completed)}.`
        : site.status === "needs_attention" && site.statusMessage
          ? site.statusMessage
          : info.text;
    actions.push({
      key: `site-${site.id}`,
      title: `${site.name}: ${info.label}`,
      text,
      href: site.status === "needs_attention" ? siteHref(site.id) : action.href,
      cta: site.status === "needs_attention" ? "Ver o que falta" : action.label,
    });
  }
  if (!input.fullName.trim()) {
    actions.push({
      key: "profile",
      title: "Complete o seu perfil",
      text: "Diga como podemos chamar você. O WhatsApp é opcional.",
      href: "/conta#dados",
      cta: "Completar perfil",
    });
  }
  return actions;
}

// Notices ------------------------------------------------------------------------------------------

export type NoticeKind =
  | "directions_ready"
  | "site_ready_for_approval"
  | "changes_requested"
  | "site_published"
  | "site_suspended"
  | "site_suspension_lifted"
  | "email_confirmed"
  | "site_deletion_warning";

export interface Notice {
  id: string;
  kind: NoticeKind;
  siteId: string | null;
  createdAt: string;
  readAt: string | null;
  /** For a deletion warning: the days left when it was made. */
  daysLeft?: number | null;
}

const noticeTexts: Record<NoticeKind, (site: string, daysLeft?: number | null) => string> = {
  directions_ready: (site) => `As 3 direções de ${site} estão prontas.`,
  site_ready_for_approval: (site) => `${site} está pronto para você conferir.`,
  changes_requested: (site) => `Nossa equipe pediu ajustes em ${site}. Estamos montando de novo.`,
  site_published: (site) => `${site} está no ar.`,
  site_suspended: (site) => `${site} foi suspenso. Veja os motivos na página do site.`,
  site_suspension_lifted: (site) => `A suspensão de ${site} foi retirada.`,
  email_confirmed: () => "Seu e-mail foi confirmado.",
  site_deletion_warning: (site, daysLeft) =>
    (daysLeft ?? 0) <= 1
      ? `${site} será apagado amanhã se não houver novidades.`
      : `${site} será apagado em ${daysLeft} dias se não houver novidades.`,
};

/** The pt-BR sentence of a notice; the site's name is plain text (rendered escaped). */
export function noticeText(
  kind: NoticeKind,
  siteName: string | undefined,
  daysLeft?: number | null,
): string {
  return (noticeTexts[kind] ?? (() => "Novidade na sua conta."))(siteName || "Seu site", daysLeft);
}

/** Where a notice leads. */
export function noticeHref(notice: Pick<Notice, "kind" | "siteId">): string {
  return notice.siteId ? siteHref(notice.siteId) : "/painel";
}
