import { emailOnlySchema } from "@/lib/auth/schemas";
import { confirmUrl, isCaptchaError, startAuthRoute } from "@/lib/server/auth-route";
import { captchaError } from "@/lib/server/captcha";
import { guardErrors, json, readBody, refuse, steadyPace } from "@/lib/server/guard";

// "Reenviar e-mail de confirmação". Supabase also waits 60 s between emails to one address.
export async function POST(request: Request) {
  const started = Date.now();
  const body = await readBody(request, emailOnlySchema);
  if ("error" in body) return body.error;
  const { email, captchaToken, next } = body.data;
  const auth = await startAuthRoute(request, "emailLink", email, captchaToken);
  if ("error" in auth) return auth.error;

  const { error } = await auth.supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: confirmUrl(request, next), captchaToken: auth.captchaToken },
  });
  await steadyPace(started);
  if (isCaptchaError(error)) return refuse(400, captchaError, { captcha: captchaError });
  if (error && (error.status ?? 500) >= 500) return refuse(503, guardErrors.unavailable);
  return json({ ok: true });
}
