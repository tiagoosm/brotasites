import { acceptTermsSchema } from "@/lib/auth/schemas";
import { guardErrors, json, readBody, refuse } from "@/lib/server/guard";
import { currentUser } from "@/lib/server/session";

// Accounts made before the terms (or before a new version) accept them here; the database
// keeps every acceptance.
export async function POST(request: Request) {
  const body = await readBody(request, acceptTermsSchema);
  if ("error" in body) return body.error;
  const session = await currentUser();
  if ("error" in session) return session.error;
  const { error } = await session.supabase.rpc("accept_terms", { p_version: body.data.version });
  if (error) return refuse(503, guardErrors.unavailable);
  return json({ ok: true });
}
