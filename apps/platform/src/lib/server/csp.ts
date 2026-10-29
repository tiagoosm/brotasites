// The platform's Content-Security-Policy (docs/security.md). The signed-in area and the
// account pages get a per-request nonce with 'strict-dynamic': an injected inline script cannot
// run there, so it cannot read the session cookie. The public pages are prerendered (no nonce
// possible) and hold no personal data; they still allow scripts only from the platform itself
// and Turnstile, and send data only to the platform and Supabase.

const TURNSTILE = "https://challenges.cloudflare.com";

/** Paths rendered per request with a nonce (the (app) route group). */
const APP_PREFIXES = [
  "/criar",
  "/meus-sites",
  "/meu-site",
  "/conta",
  "/admin",
  "/entrar",
  "/cadastro",
  "/esqueci-senha",
  "/redefinir-senha",
];

/** Pages that need a session; the proxy sends people without one to /entrar. */
export const PROTECTED_PREFIXES = ["/criar", "/meus-sites", "/meu-site", "/conta", "/admin"];

/** Pages and routes that are never cached nor indexed. */
const PRIVATE_PREFIXES = [...APP_PREFIXES, "/auth", "/api"];

const under = (path: string, prefixes: string[]) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

export const isAppPath = (path: string) => under(path, APP_PREFIXES);
export const isProtectedPath = (path: string) => under(path, PROTECTED_PREFIXES);
export const isPrivatePath = (path: string) => under(path, PRIVATE_PREFIXES);

function origin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(
  nonce: string | null,
  env: Record<string, string | undefined> = process.env,
): string {
  const supabase = origin(env.NEXT_PUBLIC_SUPABASE_URL);
  const previews = origin(env.NEXT_PUBLIC_PREVIEW_ORIGIN);
  const dev = env.NODE_ENV !== "production";
  const list = (...items: (string | null | undefined | false)[]) => items.filter(Boolean).join(" ");
  const scripts = nonce
    ? list("'self'", `'nonce-${nonce}'`, "'strict-dynamic'", TURNSTILE, dev && "'unsafe-eval'")
    : list("'self'", "'unsafe-inline'", TURNSTILE, dev && "'unsafe-eval'");
  return [
    "default-src 'self'",
    `script-src ${scripts}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${list("'self'", "data:", "blob:", supabase, previews)}`,
    "font-src 'self' data:",
    `connect-src ${list("'self'", supabase, supabase?.replace(/^http/, "ws"), TURNSTILE)}`,
    `frame-src ${list(TURNSTILE, previews)}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
