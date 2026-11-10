import { cookies } from "next/headers";
import { RECOVERY_COOKIE, recoveryState } from "@/lib/auth/recovery";
import { changePasswordSchema, newPassword } from "@/lib/auth/schemas";
import { isCaptchaError, isRateLimited } from "@/lib/server/auth-route";
import { captchaError, captchaTokenFor } from "@/lib/server/captcha";
import { clientIp, guardErrors, json, limitKey, readBody, refuse } from "@/lib/server/guard";
import { rulesFor, withinLimits } from "@/lib/server/rate-limit";
import { accountErrors, currentUser, sessionClaims, signedInRecently } from "@/lib/server/session";

// Changing the password asks for the current one; creating one (accounts made with the old
// sign-in link)
// or resetting it after "Esqueci a senha" needs a recent sign-in instead. Either way the other
// devices are signed out.
export async function POST(request: Request) {
  const body = await readBody(request, changePasswordSchema);
  if ("error" in body) return body.error;
  const session = await currentUser();
  if ("error" in session) return session.error;
  const { supabase, user } = session;
  const email = user.email ?? "";
  const ip = clientIp(request);
  if (!(await withinLimits(rulesFor("account", ip, email, limitKey)))) {
    return refuse(429, guardErrors.rateLimited);
  }
  const checked = newPassword().safeParse(body.data.password);
  if (!checked.success) {
    const message = checked.error.issues[0]?.message ?? guardErrors.invalid;
    return refuse(400, message, { password: message });
  }

  if (body.data.currentPassword) {
    const token = captchaTokenFor(body.data.captchaToken);
    if (!token) return refuse(400, captchaError, { captcha: captchaError });
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: body.data.currentPassword,
      options: { captchaToken: token.token },
    });
    if (isCaptchaError(error)) return refuse(400, captchaError, { captcha: captchaError });
    if (isRateLimited(error)) return refuse(429, guardErrors.rateLimited);
    if (error) {
      const message = "A senha atual não confere.";
      return refuse(400, message, { currentPassword: message });
    }
  }
  // The "Esqueci a senha" session (E30): good for 15 minutes, and it ends with the change.
  const claims = await sessionClaims(supabase);
  const marker = (await cookies()).get(RECOVERY_COOKIE)?.value;
  const recovery = recoveryState(claims, marker);
  if (recovery === "expired") return json({ error: accountErrors.reauth, reauth: true }, 403);
  if (!body.data.currentPassword && recovery !== "active" && !signedInRecently(claims?.amr)) {
    return json({ error: accountErrors.reauth, reauth: true }, 403);
  }

  const { error } = await supabase.auth.updateUser({ password: body.data.password });
  if (error?.code === "same_password") {
    const message = "A nova senha precisa ser diferente da atual.";
    return refuse(400, message, { password: message });
  }
  if (error?.code === "weak_password") {
    const message = "Essa senha apareceu em vazamentos de dados. Escolha outra.";
    return refuse(400, message, { password: message });
  }
  if (error) return refuse(503, guardErrors.unavailable);
  if (recovery === "active") {
    // Every session ends, this one too: the person signs in with the new password (E30).
    await supabase.auth.signOut({ scope: "global" });
    const done = json({ ok: true, signedOut: true });
    done.cookies.delete(RECOVERY_COOKIE);
    return done;
  }
  await supabase.auth.signOut({ scope: "others" });
  return json({ ok: true });
}
