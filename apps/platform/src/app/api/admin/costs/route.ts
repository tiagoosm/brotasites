import { aiBudget } from "@/lib/admin/budget";
import { requireAdmin, teamRpcError } from "@/lib/server/admin";
import { json } from "@/lib/server/guard";

// Team panel, costs of the last 30 days (E24).
export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const [costs, overview] = await Promise.all([
    admin.session.rpc("admin_costs", { p_days: 30 }),
    admin.session.rpc("admin_overview"),
  ]);
  if (costs.error) return teamRpcError(costs.error.message);
  const today = (overview.data as { today?: { spentUsd?: number } } | null)?.today;
  return json({ costs: costs.data, today: today ?? null, budget: aiBudget() });
}
