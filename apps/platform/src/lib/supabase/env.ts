// Supabase is optional: without these variables the form still works, saving on the device.
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

/** Keeps redirects inside the platform ("/criar/cores"), never to another site. */
export function safeNextPath(
  value: string | null | undefined,
  fallback = "/criar/negocio",
): string {
  return value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : fallback;
}
