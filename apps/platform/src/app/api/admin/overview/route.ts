import { aiBudget } from "@/lib/admin/budget";
import { requireAdmin, teamRpcError } from "@/lib/server/admin";
import { json } from "@/lib/server/guard";

// Team panel, overview (E24): the database aggregates (admin_overview) with the member's own
// session; it checks the team and the second step again.
export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const { data, error } = await admin.session.rpc("admin_overview");
  if (error) return teamRpcError(error.message);
  return json({ overview: data, budget: aiBudget() });
}
