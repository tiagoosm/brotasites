import { z } from "zod";
import { limits } from "@/config/limits";
import { siteSlotCopy } from "@/lib/limits-copy";
import { clientIp, guardErrors, json, limitKey, readBody, refuse } from "@/lib/server/guard";
import { rulesFor, withinLimits } from "@/lib/server/rate-limit";
import { currentUser } from "@/lib/server/session";
import { getAdminSupabase } from "@/lib/supabase/admin";

// A new site (E24): one unpaid site in progress per account, decided by the database
// (server_create_site and the trigger behind it), with the allowance from config/limits.ts.

const OPEN = [
  "draft",
  "generating_directions",
  "awaiting_direction_choice",
  "building",
  "in_review",
  "awaiting_approval",
  "needs_attention",
];

export async function POST(request: Request) {
  const body = await readBody(request, z.object({}).strict());
  if ("error" in body) return body.error;
  const session = await currentUser();
  if ("error" in session) return session.error;
  if (!(await withinLimits(rulesFor("sites", clientIp(request), session.user.id, limitKey)))) {
    return refuse(429, guardErrors.rateLimited);
  }
  const admin = getAdminSupabase();
  if (!admin) return refuse(503, guardErrors.unavailable);
  const { data, error } = await admin.rpc("server_create_site", {
    p_user_id: session.user.id,
    p_open_sites: limits.openSitesPerAccount,
    p_draft: {},
  });
  if (error) {
    if (error.message?.includes("site_in_progress")) {
      // The site in progress, read with the person's own session, for the link.
      const { data: open } = await session.supabase
        .from("sites")
        .select("id")
        .in("status", OPEN)
        .order("updated_at", { ascending: false })
        .limit(1);
      return json({ error: siteSlotCopy.blocked, siteId: open?.[0]?.id ?? null }, 409);
    }
    return refuse(503, guardErrors.unavailable);
  }
  return json({ id: data as string }, 201);
}
