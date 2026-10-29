import { emailOnlySchema } from "@/lib/auth/schemas";
import { confirmUrl, isCaptchaError, isRateLimited, startAuthRoute } from "@/lib/server/auth-route";
import { captchaError } from "@/lib/server/captcha";
import { guardErrors, json, readBody, refuse, steadyPace } from "@/lib/server/guard";

// The sign-in link by email (the magic link of E10, now an alternative to the password). It
// never creates an account: that needs the name and the accepted terms (/cadastro). Existing or
// not, the answer is the same.
export async function POST(request: Request) {
  const started = Date.now();
  const body = await readBody(request, emailOnlySchema);
  if ("error" in body) return body.error;
  const { email, captchaToken, next } = body.data;
  const auth = await startAuthRoute(request, "emailLink", email, captchaToken);
  if ("error" in auth) return auth.error;

  const { error } = await auth.supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: confirmUrl(request, next),
      captchaToken: auth.captchaToken,
    },
  });
  await steadyPace(started);
  if (isCaptchaError(error)) return refuse(400, captchaError, { captcha: captchaError });
  if (error && (error.status ?? 500) >= 500) return refuse(503, guardErrors.unavailable);
  // An unknown email ("signups not allowed") and the per-email wait look like a success.
  if (isRateLimited(error) && error?.code !== "over_email_send_rate_limit") {
    return refuse(429, guardErrors.rateLimited);
  }
  return json({ ok: true });
}
