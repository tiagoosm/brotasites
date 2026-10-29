import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { isSecureRequest, sessionCookieOptions } from "./cookies";
import { supabaseEnv } from "./env";

/** Server client bound to the request cookies, or null when Supabase is not configured. */
export async function getServerSupabase() {
  const env = supabaseEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  const secure = isSecureRequest(await headers());
  return createServerClient(env.url, env.key, {
    cookieOptions: sessionCookieOptions(secure),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * For the account routes (sign-up, sign-in, links): the same cookie session, and, when the
 * owner turns on IP forwarding in Supabase (SUPABASE_FORWARD_IP=true, docs/owner-steps.md),
 * the visitor's IP for Supabase's own per-IP limits. Forwarding needs the secret key; the key
 * only signs the request to Auth, the session stays the person's.
 */
export async function getAuthSupabase(ip: string) {
  const env = supabaseEnv();
  if (!env) return null;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const forward = process.env.SUPABASE_FORWARD_IP === "true" && secret && ip !== "unknown";
  const cookieStore = await cookies();
  const secure = isSecureRequest(await headers());
  return createServerClient(env.url, forward ? secret : env.key, {
    cookieOptions: sessionCookieOptions(secure),
    global: forward ? { headers: { "sb-forwarded-for": ip } } : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
      },
    },
  });
}
