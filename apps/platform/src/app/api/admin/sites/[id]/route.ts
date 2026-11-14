import { NextResponse } from "next/server";
import { adminJobs } from "@/lib/job-failures";
import { jobStepLabels, retryPlan } from "@/lib/retry-job";
import { isUuid, requireAdmin } from "@/lib/server/admin";
import { errors, fail } from "@/lib/server/session";

const SIGNED_SECONDS = 3600;

// One site for the review: the client's answers, the approved direction with its screenshots,
// the private preview, every reviewer report, the timeline and the admins' decisions, and (E39)
// the recent jobs with their masked errors.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail(404, errors.notFound);
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const { db } = admin;
  const { data: site } = await db
    .from("sites")
    .select(
      "id, owner_id, status, status_message, subdomain, round, preview_token, approved_direction, approved_at, published_at, offline_from, offline_by, offline_public_reason, delete_after, deletion_by, deletion_attempts, deletion_error, created_at, updated_at, site_configs(draft)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!site) return fail(404, errors.notFound);
  const [direction, reports, events, decisions, payments, owner, jobs, takedowns, refunds] =
    await Promise.all([
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
      db
        .from("jobs")
        .select("id, kind, status, attempts, error, payload, created_at, started_at, finished_at")
        .eq("site_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      // E42: taking offline and deletion, by the client or the team (kept after a deletion).
      db
        .from("site_takedowns")
        .select("action, actor, reason, note, delete_after, created_at")
        .eq("site_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      // E43: withdrawals (direito de arrependimento) and whether the team already refunded them.
      db
        .from("refund_requests")
        .select("id, amount_cents, status, requested_at, resolved_at, note")
        .eq("site_id", id)
        .order("requested_at", { ascending: false }),
    ]);
  // E39: whether "Tentar de novo" can run now, and which step it would run.
  const plan = retryPlan(site.status as string, jobs.data ?? [], admin.userId);
  const retry = plan.ok
    ? { available: true, step: jobStepLabels[plan.kind], used: plan.used, limit: plan.limit }
    : { available: false, reason: plan.reason, used: plan.used, limit: plan.limit };
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
      takedowns: takedowns.data ?? [],
      refunds: refunds.data ?? [],
      // E42: what delete_now would refuse (a job on the way or a charge not settled).
      deleteBlockers: {
        job: (jobs.data ?? []).some((job) => ["queued", "running"].includes(job.status as string)),
        payment: (payments.data ?? []).some((payment) => payment.status === "pending"),
      },
      retry,
      // E39: the recent jobs, newest first, errors masked (admin only).
      jobs: adminJobs(jobs.data ?? []).slice(0, 10),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
