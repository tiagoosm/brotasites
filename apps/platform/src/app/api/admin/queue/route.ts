import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";

const QUEUE = ["in_review", "needs_attention", "suspended"];

// The review queue: sites waiting for a person, oldest first, with what the reviewer said.
export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const { data: sites, error } = await admin.db
    .from("sites")
    .select("id, status, status_message, subdomain, updated_at, site_configs(draft)")
    .eq("schema_version", "1.2")
    .in("status", QUEUE)
    .order("updated_at", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (sites ?? []).map((site) => site.id as string);
  const { data: reports } = ids.length
    ? await admin.db
        .from("review_reports")
        .select("site_id, status, created_at")
        .in("site_id", ids)
        .order("created_at", { ascending: false })
    : { data: [] };
  const latest = new Map<string, string>();
  for (const report of reports ?? []) {
    if (!latest.has(report.site_id as string))
      latest.set(report.site_id as string, report.status as string);
  }
  return NextResponse.json(
    (sites ?? []).map((site) => {
      const config = Array.isArray(site.site_configs) ? site.site_configs[0] : site.site_configs;
      const business =
        (config?.draft as { business?: Record<string, string> } | undefined)?.business ?? {};
      return {
        id: site.id,
        status: site.status,
        statusMessage: site.status_message,
        subdomain: site.subdomain,
        updatedAt: site.updated_at,
        name: business.name ?? null,
        category: business.category ?? null,
        city: business.city ?? null,
        state: business.state ?? null,
        review: latest.get(site.id as string) ?? null,
      };
    }),
    { headers: { "cache-control": "private, no-store" } },
  );
}
