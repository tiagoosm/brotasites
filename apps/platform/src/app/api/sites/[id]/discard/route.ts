import { z } from "zod";
import { clientIp, guardErrors, json, limitKey, readBody, refuse } from "@/lib/server/guard";
import { rulesFor, withinLimits } from "@/lib/server/rate-limit";
import { errors, ownSite } from "@/lib/server/session";
import { cleanUpRemovedSite, type Removed } from "@/lib/server/site-removal";
import { getAdminSupabase } from "@/lib/supabase/admin";

// Discarding an unpaid site (E24), after a confirmation in the interface: the database checks
// it is the person's and not paid, removes it and keeps a record; then its files go.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await readBody(request, z.object({ confirm: z.literal(true) }).strict());
  if ("error" in body) return body.error;
  const { id } = await params;
  const owned = await ownSite(id);
  if ("error" in owned) return owned.error;
  if (!(await withinLimits(rulesFor("sites", clientIp(request), owned.user.id, limitKey)))) {
    return refuse(429, guardErrors.rateLimited);
  }
  const admin = getAdminSupabase();
  if (!admin) return refuse(503, guardErrors.unavailable);
  const { data, error } = await admin.rpc("server_discard_site", {
    p_site_id: id,
    p_user_id: owned.user.id,
  });
  if (error) {
    if (error.message?.includes("not_removable")) {
      return refuse(409, "Este site já foi pago e não pode ser descartado.");
    }
    if (error.message?.includes("site_not_found")) return refuse(404, errors.notFound);
    return refuse(503, guardErrors.unavailable);
  }
  await cleanUpRemovedSite(admin, data as Removed);
  return json({ discarded: true });
}
