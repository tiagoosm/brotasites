// Supabase is optional: without these variables the form still works, saving on the device.
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

/**
 * Keeps redirects inside the platform ("/criar/123/marca"), never to another site: a path that
 * starts with one "/" and has no backslash, space or control character anywhere (browsers drop
 * tabs and newlines, so "/\t/evil.com" would become "//evil.com").
 */
export function safeNextPath(value: string | null | undefined, fallback = "/criar"): string {
  if (!value || value.length > 300) return fallback;
  return /^\/(?![/\\])[^\\\s\p{Cc}]*$/u.test(value) ? value : fallback;
}
