import { changeEmailSchema } from "@/lib/auth/schemas";
import { confirmUrl, isRateLimited } from "@/lib/server/auth-route";
import { clientIp, guardErrors, json, limitKey, readBody, refuse } from "@/lib/server/guard";
import { rulesFor, withinLimits } from "@/lib/server/rate-limit";
import { accountErrors, currentUser, sessionClaims, signedInRecently } from "@/lib/server/session";

// Changing the email needs a recent sign-in, and the new address confirms it by link (Supabase
// sends it; with "Secure email change" on, the old address confirms too). Confirming signs out
// the other devices (/auth/confirm).
export async function POST(request: Request) {
  const body = await readBody(request, changeEmailSchema);
  if ("error" in body) return body.error;
  const session = await currentUser();
  if ("error" in session) return session.error;
  if (!signedInRecently((await sessionClaims(session.supabase))?.amr)) {
    return json({ error: accountErrors.reauth, reauth: true }, 403);
  }
  const ip = clientIp(request);
  if (!(await withinLimits(rulesFor("account", ip, session.user.email, limitKey)))) {
    return refuse(429, guardErrors.rateLimited);
  }
  if (body.data.email === session.user.email) {
    return refuse(400, "Esse já é o seu e-mail.", { email: "Esse já é o seu e-mail." });
  }
  const { error } = await session.supabase.auth.updateUser(
    { email: body.data.email },
    { emailRedirectTo: confirmUrl(request, "/conta", "/conta") },
  );
  if (isRateLimited(error)) return refuse(429, guardErrors.rateLimited);
  if (error && (error.status ?? 500) >= 500) return refuse(503, guardErrors.unavailable);
  // An address already in use gets the same answer: no list of accounts by trial.
  return json({ ok: true });
}
