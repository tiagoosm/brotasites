import { NextResponse } from "next/server";
import { retryPlan, retryRefusals } from "@/lib/retry-job";
import { adminErrors, isUuid, requireAdmin } from "@/lib/server/admin";
import { triggerJob } from "@/lib/server/jobs";
import { errors, fail } from "@/lib/server/session";

// "Tentar de novo" (E39): runs the failed step of a site in needs_attention again, as a new job
// with the same payload, without creating another site. Team only, after a confirmation in the
// panel ({"confirm": true}), at most limits.adminRetriesPerDay times in 24 hours per site.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail(404, errors.notFound);
  const admin = await requireAdmin(request);
  if ("error" in admin) return admin.error;
  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== true) return fail(400, adminErrors.badRequest);
  const { db } = admin;

  const { data: site } = await db.from("sites").select("id, status").eq("id", id).maybeSingle();
  if (!site) return fail(404, errors.notFound);
  const { data: jobs, error: jobsError } = await db
    .from("jobs")
    .select("id, kind, status, payload, created_at")
    .eq("site_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (jobsError) return fail(503, errors.unavailable);
  const plan = retryPlan(site.status as string, jobs ?? [], admin.userId);
  if (!plan.ok) {
    const [status, message] = retryRefusals[plan.reason];
    return fail(status, message);
  }

  // The status change is the lock: only one request moves the site out of needs_attention.
  const { data: moved } = await db
    .from("sites")
    .update({ status: plan.nextStatus, status_message: null })
    .eq("id", id)
    .eq("status", "needs_attention")
    .select("id");
  if (!moved?.length) {
    const [status, message] = retryRefusals.wrong_status;
    return fail(status, message);
  }
  const { data: job, error } = await db
    .from("jobs")
    .insert({ site_id: id, kind: plan.kind, payload: plan.payload })
    .select("id")
    .single();
  if (error || !job) {
    // Put the site back, so the button stays available.
    await db
      .from("sites")
      .update({ status: "needs_attention" })
      .eq("id", id)
      .eq("status", plan.nextStatus);
    return fail(503, errors.unavailable);
  }
  await db.from("site_events").insert({
    site_id: id,
    kind: "retry_started",
    message: "Nossa equipe pediu uma nova tentativa. Estamos trabalhando no seu site.",
  });
  const started = await triggerJob(job.id as string);
  return NextResponse.json({
    jobId: job.id,
    started,
    status: plan.nextStatus,
    used: plan.used + 1,
    limit: plan.limit,
  });
}
