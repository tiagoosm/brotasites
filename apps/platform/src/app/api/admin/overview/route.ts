import { aiBudget } from "@/lib/admin/budget";
import { failuresBySite } from "@/lib/job-failures";
import { requireAdmin, teamRpcError } from "@/lib/server/admin";
import { generationStatus, STUCK_JOB_MINUTES } from "@/lib/server/generation";
import { json } from "@/lib/server/guard";
import { runningCutoff, STUCK_RUNNING_MINUTES } from "@/lib/stuck-job";

// Team panel, overview (E24): the database aggregates (admin_overview) with the member's own
// session; it checks the team and the second step again. E34: whether generation is set up
// (names of what is missing, never values) and how many jobs wait queued past the limit.
export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const { data, error } = await admin.session.rpc("admin_overview");
  if (error) return teamRpcError(error.message);
  const since = new Date(Date.now() - STUCK_JOB_MINUTES * 60_000).toISOString();
  const { count } = await admin.db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued")
    .lt("created_at", since);
  // E37: jobs "running" with no process left (killed, e.g. out of memory).
  const { count: running } = await admin.db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "running")
    .lt("started_at", runningCutoff());
  // E39: the sites that need attention, newest first, with what went wrong in a short line.
  const { data: attention } = await admin.db
    .from("sites")
    .select("id, updated_at, site_configs(draft)")
    .eq("status", "needs_attention")
    .order("updated_at", { ascending: false })
    .limit(10);
  const attentionIds = (attention ?? []).map((site) => site.id as string);
  const { data: failedJobs } = attentionIds.length
    ? await admin.db
        .from("jobs")
        .select("site_id, id, kind, status, error, payload, created_at, finished_at")
        .in("site_id", attentionIds)
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const failureOf = failuresBySite(failedJobs ?? []);
  const failures = (attention ?? []).map((site) => {
    const config = Array.isArray(site.site_configs) ? site.site_configs[0] : site.site_configs;
    const name = (config?.draft as { business?: { name?: string } } | undefined)?.business?.name;
    return {
      siteId: site.id as string,
      name: name ?? null,
      updatedAt: site.updated_at as string,
      failure: failureOf.get(site.id as string) ?? null,
    };
  });
  const { enforced, missing, ready } = generationStatus();
  return json({
    overview: data,
    budget: aiBudget(),
    generation: {
      enforced,
      ready,
      missing,
      stuckJobs: (count ?? 0) + (running ?? 0),
      stuckMinutes: STUCK_JOB_MINUTES,
      stuckRunningMinutes: STUCK_RUNNING_MINUTES,
    },
    failures,
  });
}
