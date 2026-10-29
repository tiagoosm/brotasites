import { profileSchema } from "@/lib/auth/schemas";
import { guardErrors, json, readBody, refuse } from "@/lib/server/guard";
import { currentUser } from "@/lib/server/session";

// Name and WhatsApp (optional). With the person's own session: RLS and the column grants allow
// only these two fields of their own profile.
export async function POST(request: Request) {
  const body = await readBody(request, profileSchema);
  if ("error" in body) return body.error;
  const session = await currentUser();
  if ("error" in session) return session.error;
  const { error } = await session.supabase
    .from("profiles")
    .update({ full_name: body.data.fullName, phone: body.data.phone || null })
    .eq("id", session.user.id);
  if (error) return refuse(503, guardErrors.unavailable);
  return json({ ok: true });
}
