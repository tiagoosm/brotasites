import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client with the secret key (bypasses RLS). Only route handlers use it, after
 * checking with the person's own session that the site is theirs. Never import it from a
 * client component: the key must not reach the browser.
 */
export function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || typeof window !== "undefined") return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
