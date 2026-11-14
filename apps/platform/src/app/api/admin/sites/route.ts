import { type AdminSiteRow, addressPattern, type OpenRefund } from "@/lib/admin/sites";
import { adminErrors, requireAdmin } from "@/lib/server/admin";
import { json, refuse } from "@/lib/server/guard";
import { errors } from "@/lib/server/session";

// Team panel, published sites (E42): search by address, filters "No ar", "Fora do ar" and
// "Exclusão agendada", a page at a time, and how many deletions are scheduled. The search goes
// in the team's own fetch, never in the page's address.
const FILTERS = ["", "live", "offline", "scheduled"] as const;
const PAGE_SIZE = 20;

/** The few filters this list chains; the full builder type is too deep for the compiler. */
interface SiteQuery {
  in(column: string, values: string[]): SiteQuery;
  eq(column: string, value: string): SiteQuery;
  is(column: string, value: null): SiteQuery;
  not(column: string, operator: string, value: null): SiteQuery;
  ilike(column: string, pattern: string): SiteQuery;
  order(column: string, options: { ascending: boolean }): SiteQuery;
  range(
    from: number,
    to: number,
  ): PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown; count: number | null }>;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 120);
  const filter = (params.get("filter") ?? "") as (typeof FILTERS)[number];
  const page = Math.max(0, Math.min(5000, Number.parseInt(params.get("page") ?? "0", 10) || 0));
  if (!FILTERS.includes(filter)) return refuse(400, adminErrors.badRequest);

  let rows = (admin.db.from("sites") as unknown as { select: (...args: unknown[]) => SiteQuery })
    .select(
      "id, subdomain, status, offline_by, delete_after, deletion_by, deletion_attempts, deletion_error, published_at, site_configs(name:draft->business->>name)",
      { count: "exact" },
    )
    .not("published_at", "is", null);
  if (filter === "live") rows = rows.in("status", ["live", "grace"]);
  if (filter === "offline") rows = rows.eq("status", "offline").is("delete_after", null);
  if (filter === "scheduled") rows = rows.not("delete_after", "is", null);
  const pattern = addressPattern(query);
  if (query && !pattern)
    return json({ rows: [], total: 0, scheduled: 0, openRefunds: [], page, pageSize: PAGE_SIZE });
  if (pattern) rows = rows.ilike("subdomain", pattern);
  rows =
    filter === "scheduled"
      ? rows.order("delete_after", { ascending: true })
      : rows.order("published_at", { ascending: false });

  const [list, scheduled, refunds] = await Promise.all([
    rows.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
    admin.db
      .from("sites")
      .select("id", { count: "exact", head: true })
      .not("delete_after", "is", null),
    // E43: withdrawals the team still has to refund at the payment provider.
    admin.db.rpc("server_open_refunds", { p_limit: 100 }),
  ]);
  if (list.error) return refuse(500, errors.unavailable);
  const result: AdminSiteRow[] = (list.data ?? []).map((row) => {
    const config = Array.isArray(row.site_configs) ? row.site_configs[0] : row.site_configs;
    return {
      id: row.id as string,
      subdomain: (row.subdomain as string | null) ?? null,
      name: ((config as { name?: string | null } | null)?.name ?? null) || null,
      status: row.status as string,
      offlineBy: (row.offline_by as string | null) ?? null,
      deleteAfter: (row.delete_after as string | null) ?? null,
      deletionBy: (row.deletion_by as string | null) ?? null,
      deletionAttempts: (row.deletion_attempts as number | null) ?? 0,
      deletionError: (row.deletion_error as string | null) ?? null,
      publishedAt: (row.published_at as string | null) ?? null,
    };
  });
  return json({
    rows: result,
    total: list.count ?? result.length,
    scheduled: scheduled.count ?? 0,
    openRefunds: (refunds.data as OpenRefund[] | null) ?? [],
    page,
    pageSize: PAGE_SIZE,
  });
}
