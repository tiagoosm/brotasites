import type { CookieOptionsWithName } from "@supabase/ssr";

// The session cookie (docs/security.md, accounts): host-only (no Domain, so it never reaches
// the client sites' BASE_DOMAIN or any other subdomain), Secure over HTTPS, SameSite=Lax. Not
// HttpOnly: the browser client reads the session for the form and "Meus sites", as Supabase's
// SSR design requires (decision of 2026-10-29, docs/owner-steps.md); the CSP limits scripts.

export function sessionCookieOptions(secure: boolean): CookieOptionsWithName {
  return { path: "/", sameSite: "lax", secure };
}

/** On the server: HTTPS behind Vercel's proxy, or a direct HTTPS request. */
export function isSecureRequest(headers: Headers, url?: string): boolean {
  const proto = headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0]?.trim() === "https";
  return url?.startsWith("https://") ?? false;
}
