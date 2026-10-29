import { safeNextPath } from "@/lib/supabase/env";
import { getAuthSupabase } from "@/lib/supabase/server";
import { captchaError, captchaTokenFor } from "./captcha";
import { clientIp, guardErrors, limitKey, refuse } from "./guard";
import { rulesFor, withinLimits } from "./rate-limit";

// The shared start of the sign-up, sign-in and email-link routes: rate limits per IP and per
// email, the CAPTCHA token Supabase will check, and the Auth client with the visitor's IP.

export type AuthRoute = "signUp" | "signIn" | "emailLink";

export async function startAuthRoute(
  request: Request,
  route: AuthRoute,
  email: string,
  captcha: string | undefined,
) {
  const ip = clientIp(request);
  if (!(await withinLimits(rulesFor(route, ip, email, limitKey)))) {
    return { error: refuse(429, guardErrors.rateLimited) } as const;
  }
  const token = captchaTokenFor(captcha);
  if (!token) return { error: refuse(400, captchaError, { captcha: captchaError }) } as const;
  const supabase = await getAuthSupabase(ip);
  if (!supabase) return { error: refuse(503, guardErrors.unavailable) } as const;
  return { supabase, captchaToken: token.token } as const;
}

/** The platform's address for the links in emails (allowed in Supabase's redirect URLs). */
export function platformOrigin(request: Request): string {
  return (process.env.NEXT_PUBLIC_PLATFORM_URL ?? new URL(request.url).origin).replace(/\/+$/, "");
}

/** Where the link in the email lands: /auth/confirm, then a safe page of the platform. */
export function confirmUrl(
  request: Request,
  next: string | undefined,
  fallback = "/criar",
): string {
  return `${platformOrigin(request)}/auth/confirm?next=${encodeURIComponent(safeNextPath(next, fallback))}`;
}

/** Supabase errors that mean "too many emails or attempts": shown as the rate-limit message. */
export function isRateLimited(error: { status?: number; code?: string } | null): boolean {
  return Boolean(
    error &&
      (error.status === 429 ||
        error.code === "over_email_send_rate_limit" ||
        error.code === "over_request_rate_limit"),
  );
}

export const isCaptchaError = (error: { code?: string } | null) => error?.code === "captcha_failed";

export const signInErrors = {
  wrong: "E-mail ou senha incorretos.",
  unconfirmed:
    "Confirme o seu e-mail antes de entrar. Procure o link que enviamos ou peça outro abaixo.",
} as const;
