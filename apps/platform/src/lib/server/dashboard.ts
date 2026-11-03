import type { DashboardSite, Notice, NoticeKind } from "@/lib/dashboard";
import { getServerSupabase } from "@/lib/supabase/server";

// Everything /painel shows, read on the server with the person's own session (RLS: only their
// rows; never the secret key). One request per kind of data, all at once: no query per site.
// Nothing admin-only is read (review notes, decision log, reviewer reports, catalog weights).

export interface DashboardData {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  fullName: string;
  sites: DashboardSite[];
  notices: Notice[];
  unread: number;
  /** The place for a new site (E24): unpaid sites in progress, the allowance, and which one. */
  slots: { open: number; allowed: number; openSiteId: string | null };
}

const MILESTONE_EVENTS = ["directions_ready", "site_built"];

interface SiteRow {
  id: string;
  status: string;
  subdomain: string | null;
  status_message: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  published_at: string | null;
  last_activity_at?: string | null;
  keep_until?: string | null;
  site_configs: { name: string | null; completed: string[] | null }[] | null;
  site_events: { kind: string; created_at: string }[] | null;
}

function toSite(row: SiteRow): DashboardSite {
  const config = Array.isArray(row.site_configs) ? row.site_configs[0] : row.site_configs;
  const first = (kind: string) =>
    (row.site_events ?? [])
      .filter((event) => event.kind === kind)
      .map((event) => event.created_at)
      .sort()[0] ?? null;
  return {
    id: row.id,
    name: config?.name?.trim() || "Site sem nome",
    status: row.status,
    subdomain: row.subdomain,
    statusMessage: row.status_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
    completed: config?.completed ?? [],
    directionsReadyAt: first("directions_ready"),
    builtAt: first("site_built"),
    lastActivityAt: row.last_activity_at ?? null,
    keepUntil: row.keep_until ?? null,
  };
}

/** The dashboard of the signed-in person, or null without a session. */
export async function loadDashboard(): Promise<DashboardData | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [profile, sites, notices, unread, slots] = await Promise.all([
    supabase.from("profiles").select("full_name").maybeSingle(),
    supabase
      .from("sites")
      .select(
        "id, status, subdomain, status_message, created_at, updated_at, approved_at, published_at, last_activity_at, keep_until, site_configs(name:draft->business->>name, completed), site_events(kind, created_at)",
      )
      .eq("schema_version", "1.2")
      .in("site_events.kind", MILESTONE_EVENTS)
      .order("updated_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("id, kind, site_id, created_at, read_at, days_left")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.rpc("my_site_slots"),
  ]);
  if (sites.error) throw sites.error;

  return {
    userId: user.id,
    email: user.email ?? "",
    emailConfirmed: Boolean(user.email_confirmed_at),
    fullName: (profile.data as { full_name?: string } | null)?.full_name ?? "",
    sites: ((sites.data ?? []) as unknown as SiteRow[]).map(toSite),
    notices: (
      (notices.data ?? []) as {
        id: string;
        kind: NoticeKind;
        site_id: string | null;
        created_at: string;
        read_at: string | null;
        days_left?: number | null;
      }[]
    ).map((row) => ({
      id: row.id,
      kind: row.kind,
      siteId: row.site_id,
      createdAt: row.created_at,
      readAt: row.read_at,
      daysLeft: row.days_left ?? null,
    })),
    unread: unread.count ?? 0,
    slots: {
      open: Number((slots.data as { open?: number } | null)?.open ?? 0),
      allowed: Number((slots.data as { allowed?: number } | null)?.allowed ?? 1),
      openSiteId: (slots.data as { openSiteId?: string | null } | null)?.openSiteId ?? null,
    },
  };
}
