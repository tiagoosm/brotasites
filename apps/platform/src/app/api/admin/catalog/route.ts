import { NextResponse } from "next/server";
import { catalogMetrics } from "@/lib/admin/metrics";
import { requireAdmin } from "@/lib/server/admin";

// The promotion cycle (docs/catalog-promotion.md): metrics per composition and per variant, the
// current recommendations and retirements, and the requests to the variant factory.
export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const { db } = admin;
  const [directions, sites, reports, decisions, events, weights, requests] = await Promise.all([
    db.from("site_directions").select("id, site_id, composition_key, identity"),
    db
      .from("sites")
      .select("id, approved_direction, approved_at")
      .not("approved_direction", "is", null),
    db.from("review_reports").select("site_id, report"),
    db.from("admin_decisions").select("site_id, action, created_at"),
    db
      .from("site_events")
      .select("site_id, kind, created_at")
      .in("kind", ["site_built", "rebuild_requested"]),
    db.from("catalog_weights").select("kind, ref, state, updated_at"),
    db
      .from("variant_requests")
      .select("id, family, section, note, status, created_at")
      .order("created_at", { ascending: false }),
  ]);
  const failed = [directions, sites, reports, decisions, events, weights, requests].find(
    (r) => r.error,
  );
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
  return NextResponse.json(
    {
      metrics: catalogMetrics({
        directions: directions.data ?? [],
        sites: sites.data ?? [],
        reports: reports.data ?? [],
        decisions: decisions.data ?? [],
        events: events.data ?? [],
      }),
      weights: weights.data ?? [],
      requests: requests.data ?? [],
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
