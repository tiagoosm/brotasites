import { NextResponse } from "next/server";
import { isUuid, requireAdmin } from "@/lib/server/admin";
import { errors, fail } from "@/lib/server/session";

const SIGNED_SECONDS = 3600;

// One site for the review: the client's answers, the approved direction with its screenshots,
// the private preview, every reviewer report, the timeline and the admins' decisions.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail(404, errors.notFound);
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const { db } = admin;
  const { data: site } = await db
    .from("sites")
    .select(
      "id, owner_id, status, status_message, subdomain, round, preview_token, approved_direction, approved_at, published_at, created_at, updated_at, site_configs(draft)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!site) return fail(404, errors.notFound);
  const [direction, reports, events, decisions, payments, owner] = await Promise.all([
    site.approved_direction
      ? db
          .from("site_directions")
          .select("id, direction, identity, screenshots, composition_key, source")
          .eq("id", site.approved_direction)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("review_reports")
      .select("status, report, created_at")
      .eq("site_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("site_events")
      .select("kind, message, created_at")
      .eq("site_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("admin_decisions")
      .select("action, note, from_status, to_status, created_at, admin_id")
      .eq("site_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("payments")
      .select("purpose, status, amount_cents, created_at, paid_at")
      .eq("site_id", id),
    db.auth.admin.getUserById(site.owner_id as string).catch(() => ({ data: { user: null } })),
  ]);
  const shots = (direction.data?.screenshots as string[] | undefined) ?? [];
  const signed = shots.length
    ? ((await db.storage.from("site-renders").createSignedUrls(shots, SIGNED_SECONDS)).data ?? [])
    : [];
  const config = Array.isArray(site.site_configs) ? site.site_configs[0] : site.site_configs;
  const { site_configs: _, owner_id: __, ...row } = site;
  return NextResponse.json(
    {
      site: row,
      draft: config?.draft ?? {},
      ownerEmail: owner.data?.user?.email ?? null,
      direction: direction.data,
      screenshots: signed.map((item) => item.signedUrl).filter(Boolean),
      reports: reports.data ?? [],
      events: events.data ?? [],
      decisions: decisions.data ?? [],
      payments: payments.data ?? [],
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
