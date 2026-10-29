import { emailOnlySchema } from "@/lib/auth/schemas";
import { confirmUrl, isCaptchaError, startAuthRoute } from "@/lib/server/auth-route";
import { captchaError } from "@/lib/server/captcha";
import { guardErrors, json, readBody, refuse, steadyPace } from "@/lib/server/guard";

// "Esqueci a senha": a link that signs in and leads to /redefinir-senha. Same answer for any
// email.
export async function POST(request: Request) {
  const started = Date.now();
  const body = await readBody(request, emailOnlySchema);
  if ("error" in body) return body.error;
  const { email, captchaToken } = body.data;
  const auth = await startAuthRoute(request, "emailLink", email, captchaToken);
  if ("error" in auth) return auth.error;

  const { error } = await auth.supabase.auth.resetPasswordForEmail(email, {
    redirectTo: confirmUrl(request, "/redefinir-senha", "/redefinir-senha"),
    captchaToken: auth.captchaToken,
  });
  await steadyPace(started);
  if (isCaptchaError(error)) return refuse(400, captchaError, { captcha: captchaError });
  if (error && (error.status ?? 500) >= 500) return refuse(503, guardErrors.unavailable);
  return json({ ok: true });
}
