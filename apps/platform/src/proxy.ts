import { type NextRequest, NextResponse } from "next/server";
import { readHosts } from "@/lib/domains/hosts";
import { routeByHost } from "@/lib/domains/routing";
import { isSecureRequest } from "@/lib/supabase/cookies";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * HSTS (E28, docs/security.md): HTTPS responses in production only, with the platform's
 * subdomains (the admin host), never in development. No preload: the owner decides that later.
 */
const HSTS = "max-age=31536000; includeSubDomains";

function secure(request: NextRequest, response: NextResponse): NextResponse {
  if (process.env.NODE_ENV === "production" && isSecureRequest(request.headers, request.url)) {
    response.headers.set("strict-transport-security", HSTS);
  }
  return response;
}

export async function proxy(request: NextRequest) {
  // Which host serves what (E28, lib/domains/routing.ts): the old Vercel address and "www." go
  // to the platform's address, and the team's area lives only on its own host when one is set.
  // Read at request time, so the same build runs with or without an admin host.
  const hosts = readHosts(process.env);
  const route = routeByHost(
    {
      host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
      path: request.nextUrl.pathname,
      search: request.nextUrl.search,
    },
    hosts,
    process.env.VERCEL_ENV === "production",
  );
  if (route.kind === "redirect") {
    return secure(
      request,
      NextResponse.redirect(route.location, {
        status: route.status,
        headers: { "cache-control": route.status === 308 ? "public, max-age=3600" : "no-store" },
      }),
    );
  }
  if (route.kind === "not-found") {
    return new NextResponse("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  if (route.admin && request.nextUrl.pathname === "/robots.txt") {
    // The team's host is never indexed.
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }
  const response = await updateSession(request);
  if (route.admin) response.headers.set("x-robots-tag", "noindex, nofollow");
  return secure(request, response);
}

export const config = {
  // Skip static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
