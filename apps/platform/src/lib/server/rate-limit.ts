import { getAdminSupabase } from "@/lib/supabase/admin";
import { isProduction } from "./captcha";

// Limits on the account routes, on top of Supabase Auth's own (docs/owner-steps.md, Accounts):
// per IP and per email, counted in the database (server_rate_limit, fixed windows) so every
// server instance shares them.

export interface LimitRule {
  key: string;
  max: number;
  windowSeconds: number;
}

export type RateLimiter = (rule: LimitRule) => Promise<boolean>;

/** The database counter, or null when the secret key is not set. */
export function databaseLimiter(): RateLimiter | null {
  const db = getAdminSupabase();
  if (!db) return null;
  return async (rule) => {
    const { data, error } = await db.rpc("server_rate_limit", {
      p_key: rule.key,
      p_max: rule.max,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) throw new Error("rate limit unavailable");
    return data === true;
  };
}

/**
 * True when every rule still has room. Every rule counts the attempt, so one busy key does not
 * hide the others. Without the database: allowed in development, refused in production.
 */
export async function withinLimits(
  rules: LimitRule[],
  limiter: RateLimiter | null = databaseLimiter(),
): Promise<boolean> {
  if (!limiter) return !isProduction();
  const results = await Promise.all(rules.map((rule) => limiter(rule).catch(() => false)));
  return results.every(Boolean);
}

/** The limits of each account route (also listed in docs/owner-steps.md). */
export const limits = {
  signUp: { ip: { max: 5, windowSeconds: 3600 }, email: { max: 3, windowSeconds: 3600 } },
  signIn: { ip: { max: 30, windowSeconds: 900 }, email: { max: 10, windowSeconds: 900 } },
  emailLink: { ip: { max: 10, windowSeconds: 3600 }, email: { max: 5, windowSeconds: 3600 } },
  account: { ip: { max: 30, windowSeconds: 3600 }, email: { max: 10, windowSeconds: 3600 } },
  // Dashboard notices (E16): the second key is the account, not an email.
  notices: { ip: { max: 300, windowSeconds: 3600 }, email: { max: 120, windowSeconds: 3600 } },
} as const;

export function rulesFor(
  route: keyof typeof limits,
  ip: string,
  email: string | undefined,
  key: (kind: string, value: string) => string,
): LimitRule[] {
  const rule = limits[route];
  const rules: LimitRule[] = [{ key: key(`${route}-ip`, ip), ...rule.ip }];
  if (email) rules.push({ key: key(`${route}-email`, email), ...rule.email });
  return rules;
}
