import { NextResponse } from "next/server";
import { triggerJob } from "@/lib/server/jobs";
import { errors, fail } from "@/lib/server/session";
import { getServerSupabase } from "@/lib/supabase/server";

// After a database function queues a job (request_directions, choose_direction, ...), the
// browser asks for it to start. Only the owner's own queued jobs are started.
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
    .select("id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return fail(404, errors.notFound);
  const started = job.status === "queued" ? await triggerJob(jobId) : false;
  return NextResponse.json({ started });
}
