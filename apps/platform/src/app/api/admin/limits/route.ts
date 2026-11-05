import { z } from "zod";
import { limits } from "@/config/limits";
import { aiBudget } from "@/lib/admin/budget";
import { adminErrors, requireAdmin, teamRpcError } from "@/lib/server/admin";
import { clientIp, guardErrors, json, limitKey, refuse } from "@/lib/server/guard";
import { rulesFor, withinLimits } from "@/lib/server/rate-limit";
import { getAdminSupabase } from "@/lib/supabase/admin";

// Team panel, limits and actions (E24). Reading: the values in force (config/limits.ts, what the
// database last received, and the AI budget from the environment) and the cleanup's dry run.
// Acting: one extra round, one extra site in progress, a later cleanup date; each is logged by
// the database with who, when, before and after. The budget and the AI stay the owner's.

export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const { data, error } = await admin.session.rpc("admin_limits");
  if (error) return teamRpcError(error.message);
  // Client domains against what the hosting includes (E25).
  const domains = await admin.session.rpc("admin_domains");
  // The dry run: what the cleanup would remove in the next 7 days (secret key, server only).
  const db = getAdminSupabase();
  const upcoming = db
    ? await db.rpc("server_idle_sites", {
        p_idle_days: limits.idleDaysBeforeDeletion,
        p_within_days: 7,
        p_limit: 50,
      })
    : { data: [] };
  return json({
    database: data,
    config: limits,
    budget: aiBudget(),
    domains: domains.error ? null : domains.data,
    upcoming: (
      (upcoming.data ?? []) as { site_id: string; status: string; deadline: string }[]
    ).map((row) => ({ siteId: row.site_id, status: row.status, deadline: row.deadline })),
  });
}

const note = z.string().trim().min(3).max(500);
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant_round"), siteId: z.uuid(), note }).strict(),
  z.object({ action: z.literal("grant_site_slot"), userId: z.uuid(), note }).strict(),
  z
    .object({
      action: z.literal("extend_cleanup"),
      siteId: z.uuid(),
      days: z.number().int().min(1).max(90),
      note,
    })
    .strict(),
]);

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if ("error" in admin) return admin.error;
  if (!(await withinLimits(rulesFor("admin", clientIp(request), admin.userId, limitKey)))) {
    return refuse(429, guardErrors.rateLimited);
  }
  const parsed = action.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return refuse(400, adminErrors.badRequest);
  const body = parsed.data;
  const call =
    body.action === "grant_round"
      ? admin.session.rpc("admin_grant_round", { p_site_id: body.siteId, p_note: body.note })
      : body.action === "grant_site_slot"
        ? admin.session.rpc("admin_grant_site_slot", {
            p_user_id: body.userId,
            p_reason: body.note,
          })
        : admin.session.rpc("admin_extend_cleanup", {
            p_site_id: body.siteId,
            p_days: body.days,
            p_note: body.note,
          });
  const { data, error } = await call;
  if (error) return teamRpcError(error.message);
  return json({ ok: true, result: data });
}
