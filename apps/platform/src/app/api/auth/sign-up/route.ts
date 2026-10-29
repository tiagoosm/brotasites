import { signUpSchema, TERMS_VERSION } from "@/lib/auth/schemas";
import { confirmUrl, isCaptchaError, isRateLimited, startAuthRoute } from "@/lib/server/auth-route";
import { captchaError } from "@/lib/server/captcha";
import { guardErrors, json, readBody, refuse, steadyPace } from "@/lib/server/guard";

// Creating an account (E15): name, email, password and the accepted terms. Supabase sends the
// confirmation link. A new and an existing email get the same answer, in about the same time.
export async function POST(request: Request) {
  const started = Date.now();
  const body = await readBody(request, signUpSchema);
  if ("error" in body) return body.error;
  const { fullName, email, password, captchaToken, next } = body.data;
  const auth = await startAuthRoute(request, "signUp", email, captchaToken);
  if ("error" in auth) return auth.error;

  const { error } = await auth.supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, terms_version: TERMS_VERSION },
      emailRedirectTo: confirmUrl(request, next),
      captchaToken: auth.captchaToken,
    },
  });
  await steadyPace(started);
  if (isCaptchaError(error)) return refuse(400, captchaError, { captcha: captchaError });
  if (isRateLimited(error)) return refuse(429, guardErrors.rateLimited);
  if (error?.code === "weak_password") {
    const message = "Essa senha apareceu em vazamentos de dados. Escolha outra.";
    return refuse(400, message, { password: message });
  }
  if (error && (error.status ?? 500) >= 500) return refuse(503, guardErrors.unavailable);
  // Anything else (including an email that already has an account) looks like a success.
  return json({ ok: true });
}
