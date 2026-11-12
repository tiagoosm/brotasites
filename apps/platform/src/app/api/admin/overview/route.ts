import { aiBudget } from "@/lib/admin/budget";
import { requireAdmin, teamRpcError } from "@/lib/server/admin";
import { generationStatus, STUCK_JOB_MINUTES } from "@/lib/server/generation";
import { json } from "@/lib/server/guard";

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
  const { enforced, missing, ready } = generationStatus();
  return json({
    overview: data,
    budget: aiBudget(),
    generation: {
      enforced,
      ready,
      missing,
      stuckJobs: count ?? 0,
      stuckMinutes: STUCK_JOB_MINUTES,
    },
  });
}
