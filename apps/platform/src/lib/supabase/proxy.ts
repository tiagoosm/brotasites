import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy, isAppPath, isPrivatePath, isProtectedPath } from "@/lib/server/csp";
import { guardErrors, sameOrigin } from "@/lib/server/guard";
import { isSecureRequest, sessionCookieOptions } from "./cookies";
import { supabaseEnv } from "./env";

/**
 * On every request: refreshes the Supabase session cookies (Supabase SSR pattern for Next.js),
 * sends people without a session away from the signed-in pages (the defense: the browser's
 * own check is only for the interface), and sets the CSP and the no-cache headers.
 */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // The example site (public/exemplo-site, made by the generator) is a client site: it keeps its
  // own markup and is shown framed on /exemplo.
  if (path.startsWith("/exemplo-site/")) return NextResponse.next();
  // CSRF: the API changes something only for the platform's own pages.
  if (path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    if (!sameOrigin(request)) {
      return NextResponse.json(
        { error: guardErrors.origin },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
  }
  const nonce = isAppPath(path) ? btoa(crypto.randomUUID()) : null;
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);
  if (nonce) requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const pending: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const env = supabaseEnv();
  let signedIn = false;

  if (env) {
    const supabase = createServerClient(env.url, env.key, {
      cookieOptions: sessionCookieOptions(isSecureRequest(request.headers, request.url)),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const cookie of cookiesToSet) {
            pending.push(cookie);
            response.cookies.set(cookie.name, cookie.value, cookie.options);
          }
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    });
    // Nothing may run between creating the client and getClaims(), or sessions break at random.
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  }

  if (isProtectedPath(path) && !signedIn) {
    const back = `${path}${request.nextUrl.search}`;
    // "Criar meu site" leads new people to create the account; the rest to sign in.
    const page = path === "/criar" ? "/cadastro" : "/entrar";
    const target = new URL(`${page}?voltar=${encodeURIComponent(back)}`, request.url);
    response = NextResponse.redirect(target, { status: 307 });
    for (const cookie of pending) response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  response.headers.set("content-security-policy", csp);
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  if (isPrivatePath(path)) {
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("x-robots-tag", "noindex");
  }
  return response;
}
