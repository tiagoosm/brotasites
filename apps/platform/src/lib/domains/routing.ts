import { type Hosts, isLocalHost } from "./hosts";

// Which host serves what (E28), decided before anything else in the proxy (src/proxy.ts):
// - the old Vercel address and "www." go to the platform's address, permanently;
// - with an admin host (NEXT_PUBLIC_ADMIN_HOST), the team's area lives only there: /admin on
//   the platform moves to it permanently, and the admin host serves only the team's area and
//   what signing in needs; anything else goes back to the platform;
// - without one (development, tests), nothing changes: /admin works on the platform's address.
// A pure function of the request's host and path, so it is tested without a server.

/** The platform's address before its own domain: kept only for Vercel's infrastructure calls. */
export const LEGACY_HOSTS = ["brotasites.vercel.app"];
/** Infrastructure calls that keep answering on the old address (Vercel Cron, the jobs). */
const INFRASTRUCTURE = ["/api/cron/", "/api/jobs/"];

/** What the admin host serves: the team's area and what signing in to it needs. */
const ADMIN_PATHS = ["/admin", "/entrar", "/auth", "/api/admin", "/api/auth"];
const ADMIN_EXACT = ["/api/account/me", "/robots.txt"];

export type HostRoute =
  | { kind: "pass"; admin: boolean }
  | { kind: "redirect"; location: string; status: 307 | 308 }
  | { kind: "not-found" };

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** "Admin.BrotaSites.com.br:443" is "admin.brotasites.com.br"; nothing when there is no host. */
export function normalizeHost(raw: string | null | undefined): string {
  const host = (raw ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (host.startsWith("[")) return host.slice(0, host.indexOf("]") + 1);
  return host.replace(/:\d+$/, "").replace(/\.$/, "");
}

export function isAdminHostPath(path: string): boolean {
  return ADMIN_PATHS.some((prefix) => under(path, prefix)) || ADMIN_EXACT.includes(path);
}

export function routeByHost(
  request: { host: string | null | undefined; path: string; search: string },
  hosts: Hosts,
  production: boolean,
): HostRoute {
  const host = normalizeHost(request.host);
  const { path, search } = request;
  const platform = hosts.platformHost;
  const to = (origin: string, target = path) => `${origin}${target}${search}`;
  const scheme = hosts.platformUrl.startsWith("http://") ? "http" : "https";

  // The old Vercel address, in production: to the real one, except infrastructure calls.
  if (
    production &&
    LEGACY_HOSTS.includes(host) &&
    !LEGACY_HOSTS.includes(platform) &&
    !INFRASTRUCTURE.some((prefix) => path.startsWith(prefix))
  ) {
    return { kind: "redirect", location: to(hosts.platformUrl), status: 308 };
  }

  // "www." before the platform's address: the address itself, path and query kept.
  if (platform && !isLocalHost(platform) && host === `www.${platform}`) {
    return { kind: "redirect", location: to(hosts.platformUrl), status: 308 };
  }

  const admin = hosts.adminHost;
  if (!admin) return { kind: "pass", admin: false };

  if (host === normalizeHost(admin)) {
    if (path === "/") {
      return { kind: "redirect", location: to(`${scheme}://${admin}`, "/admin"), status: 307 };
    }
    // Signing in on the admin host goes back to the team's area, never to the client pages.
    if (path === "/entrar" && !search.includes("voltar=")) {
      return {
        kind: "redirect",
        location: `${scheme}://${admin}/entrar?voltar=%2Fadmin`,
        status: 307,
      };
    }
    if (isAdminHostPath(path)) return { kind: "pass", admin: true };
    return { kind: "redirect", location: to(hosts.platformUrl), status: 308 };
  }

  // The platform's address (or any other host Vercel sends here): the team's area moved.
  if (under(path, "/admin")) {
    return { kind: "redirect", location: to(`${scheme}://${admin}`), status: 308 };
  }
  if (under(path, "/api/admin")) return { kind: "not-found" };
  return { kind: "pass", admin: false };
}
