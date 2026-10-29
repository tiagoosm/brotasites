"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sessionCookieOptions } from "./cookies";
import { supabaseEnv } from "./env";

let client: SupabaseClient | null | undefined;

/** Browser client, or null when Supabase is not configured. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const env = supabaseEnv();
  client = env
    ? createBrowserClient(env.url, env.key, {
        cookieOptions: sessionCookieOptions(window.location.protocol === "https:"),
      })
    : null;
  return client;
}
