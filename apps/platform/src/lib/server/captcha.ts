// Bot protection on sign-up, sign-in and password reset: Cloudflare Turnstile through
// Supabase Auth's own CAPTCHA support (docs/owner-steps.md, Accounts). Supabase checks every
// token itself, so the Auth API refuses bots even when they skip these pages. The platform
// only carries the token and refuses to run in production without a real site key.
//
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY  the widget's site key (the secret goes in Supabase only)
//   NEXT_PUBLIC_CAPTCHA_MODE        "simulated" in development and tests, never in production

export type CaptchaMode = "turnstile" | "simulated" | "misconfigured";

/** Production on Vercel. */
export function isProduction(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production";
}

export function captchaMode(env: Record<string, string | undefined> = process.env): CaptchaMode {
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (siteKey && env.NEXT_PUBLIC_CAPTCHA_MODE !== "simulated") return "turnstile";
  if (isProduction(env)) return "misconfigured";
  return env.NEXT_PUBLIC_CAPTCHA_MODE === "simulated" || !siteKey ? "simulated" : "turnstile";
}

/** The token sent to Supabase, or null when the request must be refused before it. */
export function captchaTokenFor(
  token: string | undefined,
  env: Record<string, string | undefined> = process.env,
): { token?: string } | null {
  const mode = captchaMode(env);
  if (mode === "misconfigured") return null;
  if (mode === "simulated") return {};
  return token ? { token } : null;
}

export const captchaError = "Confirme que você não é um robô e tente de novo.";
