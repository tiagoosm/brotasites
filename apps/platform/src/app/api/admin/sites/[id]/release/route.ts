import { NextResponse } from "next/server";
import { releasePlan, releaseRefusals } from "@/lib/release-review";
import { adminErrors, isUuid, requireAdmin } from "@/lib/server/admin";
import { triggerJob } from "@/lib/server/jobs";
import { errors, fail } from "@/lib/server/session";

// "Liberar para o cliente" (E46): a site the automatic review held for a measured problem goes
// to the client as the reviewer left it (the last config, a private preview), after a person
// read the report. Team only, after a confirmation in the panel ({"confirm": true}); never after
// a security finding or an invalid config. Who did it goes in the job's payload (releasedBy).
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
  const [jobs, reports] = await Promise.all([
    db
      .from("jobs")
      .select("id, kind, status, payload, created_at")
      .eq("site_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("review_reports")
      .select("status, report, created_at")
      .eq("site_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (jobs.error || reports.error) return fail(503, errors.unavailable);
  const plan = releasePlan(
    site.status as string,
    reports.data ?? [],
    jobs.data ?? [],
    admin.userId,
  );
  if (!plan.ok) {
    const [status, message] = releaseRefusals[plan.reason];
    return fail(status, message);
  }

  // The status change is the lock: a double click moves the site once.
  const { data: moved } = await db
    .from("sites")
    .update({ status: "building", status_message: null })
    .eq("id", id)
    .eq("status", "needs_attention")
    .select("id");
  if (!moved?.length) {
    const [status, message] = releaseRefusals.wrong_status;
    return fail(status, message);
  }
  const { data: job, error } = await db
    .from("jobs")
    .insert({ site_id: id, kind: "build", payload: plan.payload })
    .select("id")
    .single();
  if (error || !job) {
    await db
      .from("sites")
      .update({ status: "needs_attention" })
      .eq("id", id)
      .eq("status", "building");
    return fail(503, errors.unavailable);
  }
  await db.from("site_events").insert({
    site_id: id,
    kind: "review_released",
    message: "Nossa equipe conferiu o seu site. Estamos preparando a prévia para você.",
  });
  const started = await triggerJob(job.id as string);
  return NextResponse.json({ jobId: job.id, started, status: "building" });
}
