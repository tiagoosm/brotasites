import { NextResponse } from "next/server";
import { triggerJob } from "@/lib/server/jobs";
import { errors, fail } from "@/lib/server/session";
import { runningCutoff } from "@/lib/stuck-job";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// After a database function queues a job (request_directions, choose_direction, ...), the
// browser asks for it to start. Only the owner's own queued jobs are started. E37: a job left
// "running" past STUCK_RUNNING_MINUTES (its process died, e.g. out of memory) goes back to the
// queue first, so "Tentar de novo" works for it too.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { jobId?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return fail(400, errors.notFound);
  const supabase = await getServerSupabase();
  if (!supabase) return fail(503, errors.unavailable);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail(401, errors.signedOut);
  // RLS: people read only the jobs of their own sites.
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, started_at")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return fail(404, errors.notFound);
  let status = job.status as string;
  if (status === "running") {
    const admin = getAdminSupabase();
    if (!admin) return fail(503, errors.unavailable);
    // Only if it is still running and still older than the limit: never a live run.
    const { data: requeued } = await admin
      .from("jobs")
      .update({ status: "queued", error: "O processo parou sem terminar a tarefa." })
      .eq("id", jobId)
      .eq("status", "running")
      .lt("started_at", runningCutoff())
      .select("id");
    if (requeued?.length) status = "queued";
  }
  const started = status === "queued" ? await triggerJob(jobId) : false;
  return NextResponse.json({ started });
}
