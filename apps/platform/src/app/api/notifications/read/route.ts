import { z } from "zod";
import { clientIp, guardErrors, json, limitKey, readBody, refuse } from "@/lib/server/guard";
import { rulesFor, withinLimits } from "@/lib/server/rate-limit";
import { currentUser } from "@/lib/server/session";

// Marks dashboard notices as read (E16), with the person's own session: RLS lets them touch
// only their notices, and only read_at (the database keeps the first time it was set).

const schema = z.union([
  z.object({ ids: z.array(z.uuid()).min(1).max(50) }).strict(),
  z.object({ all: z.literal(true) }).strict(),
]);

export async function POST(request: Request) {
  const body = await readBody(request, schema);
  if ("error" in body) return body.error;
  const session = await currentUser();
  if ("error" in session) return session.error;
  if (!(await withinLimits(rulesFor("notices", clientIp(request), session.user.id, limitKey)))) {
    return refuse(429, guardErrors.rateLimited);
  }

  let query = session.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() }, { count: "exact" })
    .eq("user_id", session.user.id)
    .is("read_at", null);
  if ("ids" in body.data) query = query.in("id", body.data.ids);
  const { error, count } = await query;
  if (error) return refuse(503, guardErrors.unavailable);
  return json({ ok: true, marked: count ?? 0 });
}
