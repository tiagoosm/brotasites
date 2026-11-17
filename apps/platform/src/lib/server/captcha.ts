// Bot protection on sign-up, sign-in and password reset: Cloudflare Turnstile through
// Supabase Auth's own CAPTCHA support (docs/owner-steps.md, Accounts). Supabase checks every
// token itself, so the Auth API refuses bots even when they skip these pages. The platform
// only carries the token and refuses to run in production without a real site key.
//
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY  the widget's site key (the secret goes in Supabase only)
//   NEXT_PUBLIC_CAPTCHA_MODE        "simulated" in development and tests, never in production;
//                                   "off" only while the owner tests the deployed platform
//                                   without Turnstile (docs/owner-steps.md, Testing before
//                                   launch). Remove it before launch.

export type CaptchaMode = "turnstile" | "simulated" | "off" | "misconfigured";

/** Production on Vercel. */
export function isProduction(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production";
}

export function captchaMode(env: Record<string, string | undefined> = process.env): CaptchaMode {
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (env.NEXT_PUBLIC_CAPTCHA_MODE === "off") return "off";
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
  if (mode === "simulated" || mode === "off") return {};
  return token ? { token } : null;
}

/**
 * E44: two different failures, two sentences. No token at all: the widget did not finish (the
 * forms no longer send without one, so this is a script or an old page). A token Supabase
 * refused: expired, used twice, or a site key and a secret of different widgets; the form
 * gets a fresh token for the next try.
 */
export const captchaMissing =
  "A verificação de segurança ainda não terminou. Espere ela concluir e tente de novo.";
export const captchaRefused = "A verificação expirou ou foi recusada. Tente de novo.";

/**
 * What the team panel and `pnpm check:launch` say about the CAPTCHA (E44). Never the key itself:
 * only whether it looks like a production key. Turnstile production site keys start with "0x";
 * the official test keys start with "1x", "2x" or "3x" (Cloudflare docs, turnstile/troubleshooting/
 * testing.mdx, read on 2026-11-17).
 */
export type SiteKeyFormat = "production" | "test" | "unexpected" | "missing";

export interface CaptchaDiagnosis {
  mode: CaptchaMode;
  siteKey: SiteKeyFormat;
  production: boolean;
  /** One sentence for the team, in pt-BR; null when all is well. */
  warning: string | null;
}

export function siteKeyFormat(value: string | undefined): SiteKeyFormat {
  const key = value?.trim();
  if (!key) return "missing";
  if (/^0x[A-Za-z0-9_-]{10,}$/.test(key)) return "production";
  if (/^[123]x[A-Za-z0-9_-]{10,}$/.test(key)) return "test";
  return "unexpected";
}

export function captchaDiagnosis(
  env: Record<string, string | undefined> = process.env,
): CaptchaDiagnosis {
  const mode = captchaMode(env);
  const siteKey = siteKeyFormat(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const production = isProduction(env);
  let warning: string | null = null;
  if (mode === "off") {
    warning = "A verificação está desligada: ninguém está protegido contra robôs.";
  } else if (mode === "misconfigured") {
    warning =
      "Falta a chave do site do Turnstile: cadastro, entrada e troca de senha estão recusados.";
  } else if (mode === "simulated" && production) {
    warning = "A verificação está simulada em produção: ninguém está protegido contra robôs.";
  } else if (mode === "turnstile" && siteKey === "test" && production) {
    warning =
      "A chave do site é uma chave de teste da Cloudflare: troque pela chave do widget de produção.";
  } else if (mode === "turnstile" && siteKey === "unexpected") {
    warning = "A chave do site não tem o formato esperado (começa com 0x). Confira na Vercel.";
  }
  return { mode, siteKey, production, warning };
}
