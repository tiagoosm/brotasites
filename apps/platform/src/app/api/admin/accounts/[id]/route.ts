import { adminErrors, isUuid, requireAdmin, teamRpcError } from "@/lib/server/admin";
import { clientIp, guardErrors, json, limitKey, refuse } from "@/lib/server/guard";
import { rulesFor, withinLimits } from "@/lib/server/rate-limit";

// Team panel, one account (E24): only what support needs; the database logs each opening.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return refuse(400, adminErrors.badRequest);
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  if (!(await withinLimits(rulesFor("admin", clientIp(request), admin.userId, limitKey)))) {
    return refuse(429, guardErrors.rateLimited);
  }
  const { data, error } = await admin.session.rpc("admin_account", { p_user_id: id });
  if (error) return teamRpcError(error.message);
  return json(data);
}
