import { signInSchema } from "@/lib/auth/schemas";
import {
  isCaptchaError,
  isRateLimited,
  signInErrors,
  startAuthRoute,
} from "@/lib/server/auth-route";
import { captchaError } from "@/lib/server/captcha";
import { guardErrors, json, readBody, refuse, steadyPace } from "@/lib/server/guard";
import { safeNextPath } from "@/lib/supabase/env";

// Signing in with the password (E15). One message for a wrong email or a wrong password. With
// a second factor enrolled (the team), the answer asks for the code before going on, but only
// while the team's switch asks for it (E33, team_settings.require_second_factor: off for now).
// If the switch can't be read, it counts as on, as before E33.
export async function POST(request: Request) {
  const started = Date.now();
  const body = await readBody(request, signInSchema);
  if ("error" in body) return body.error;
  const { email, password, captchaToken, next } = body.data;
  const auth = await startAuthRoute(request, "signIn", email, captchaToken);
  if ("error" in auth) return auth.error;

  const { error } = await auth.supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: auth.captchaToken },
  });
  await steadyPace(started, 600);
  if (isCaptchaError(error)) return refuse(400, captchaError, { captcha: captchaError });
  if (isRateLimited(error)) return refuse(429, guardErrors.rateLimited);
  if (error?.code === "email_not_confirmed") {
    return json({ error: signInErrors.unconfirmed, unconfirmed: true }, 403);
  }
  if (error && (error.status ?? 500) >= 500) return refuse(503, guardErrors.unavailable);
  if (error) return refuse(400, signInErrors.wrong);

  const target = safeNextPath(next);
  const { data: level } = await auth.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (
    level?.nextLevel === "aal2" &&
    level.currentLevel !== "aal2" &&
    (await secondFactorOn(auth))
  ) {
    return json({ ok: true, next: `/entrar/verificacao?voltar=${encodeURIComponent(target)}` });
  }
  return json({ ok: true, next: target });
}

/** The team's switch (E33); anything but a clear "off" keeps the second factor on. */
async function secondFactorOn(auth: {
  supabase: { rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }> };
}) {
  const { data, error } = await auth.supabase.rpc("second_factor_required");
  return Boolean(error) || data !== false;
}
