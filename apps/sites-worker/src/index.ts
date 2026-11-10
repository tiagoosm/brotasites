// Serves every client site from the R2 bucket, in one of two ways:
//
// - Domain mode (production): <subdomain>.<BASE_DOMAIN> serves that client's site, and a
//   client's own domain serves the site KV maps it to (domain:<host>).
// - Path mode (testing, before the domain exists): on the Worker's free *.workers.dev
//   address, /<subdomain>/ serves that site. The page sets a cookie with the site it
//   belongs to, so files the site asks for by absolute path (/_astro/...) are found too.
//
// Layout in the bucket (written by the generation jobs, packages/generator/src/r2.ts):
//   sites/<subdomain>/<deploy id>/...    the files of a deploy
//   exports/<subdomain>/<deploy id>.zip  the client's copy of that deploy
//   previews/<site id>/<token>/...      a private preview of a site before it goes live
//   sites/<subdomain>/current            the live deploy, for sites published before KV
// And in Workers KV (packages/generator/src/kv.ts):
//   site:<subdomain>   {"version", "previous", "state"}: the live deploy and the site's state
//   domain:<host>      the subdomain a client's custom domain serves; or, for the root of a www
//                      pair, {"subdomain", "redirectTo": <host>} (E25)
//   preview:<site id>  {"token", "expiresAt"}: the only token that opens the preview
// A new deploy is uploaded in full before its pointer changes, so visitors never see a
// half-updated site. A suspended site shows a neutral page; an offline one says it left.
//
// Previews (the finished-site screen, docs/product.md) live at previa.<BASE_DOMAIN>/<site
// id>/<token>/, or /previa/<site id>/<token>/ on the testing address: a secret token in the
// address, never indexed, never cached, and no referrer, so the token does not leak. The same
// host serves the .zip export at /_export/<subdomain>, with a link the platform signs.

import { policyFor, securityHeaders } from "./headers";

export interface Env {
  SITES: R2Bucket;
  HOSTING: KVNamespace;
  BASE_DOMAIN: string;
  /** Shared with the platform, which signs the export links. Without it, exports are off. */
  EXPORT_SECRET?: string;
  /**
   * The platform's address (https://brotasites.com.br, E28). Whoever types only the sites'
   * domain (brotasites.com, www.brotasites.com) is sent there. Without it, those hosts get 404.
   */
  PLATFORM_URL?: string;
}

export type SiteState = "active" | "grace" | "suspended" | "offline";

export interface SiteRecord {
  version: string;
  state: SiteState;
  /** The client's own domain when it is the main address (E25): the other one redirects to it. */
  canonicalHost?: string;
}

const STATES: readonly SiteState[] = ["active", "grace", "suspended", "offline"];
const VERSION = /^[\w-]+$/;
const HOST = /^[a-z0-9.-]{3,253}$/;
/** Longest an export link may be valid for. */
const EXPORT_MAX_SECONDS = 3600;

const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;
const TEST_HOST_SUFFIX = ".workers.dev";
const SITE_COOKIE = "brotasites_site";
const PREVIEW_HOST = "previa";
const SITE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PREVIEW_TOKEN = /^[A-Za-z0-9_-]{32,64}$/;

/** The subdomain of a request host, or null when the host is not a client site. */
export function siteFromHost(host: string, domain: string): string | null {
  const suffix = `.${domain}`;
  if (!host.endsWith(suffix)) return null;
  const subdomain = host.slice(0, -suffix.length);
  return SUBDOMAIN.test(subdomain) ? subdomain : null;
}

/** File keys to try for a URL path: "/" → index.html, "/sobre" → sobre, sobre/index.html. */
export function candidateKeys(pathname: string): string[] | null {
  let path: string;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (path.includes("..") || path.includes("\\") || path.includes("\0")) return null;
  const clean = path.replace(/^\/+/, "");
  if (clean === "" || clean.endsWith("/")) return [`${clean}index.html`];
  const last = clean.split("/").pop() ?? "";
  return last.includes(".") ? [clean] : [clean, `${clean}/index.html`];
}

export function isTestHost(host: string): boolean {
  return host.endsWith(TEST_HOST_SUFFIX);
}

function cookieSite(request: Request): string | null {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${SITE_COOKIE}=([^;]+)`));
  const site = match?.[1];
  return site && SUBDOMAIN.test(site) ? site : null;
}

function cacheControl(key: string): string {
  // Astro fingerprints everything in _astro/, so those files never change.
  return key.startsWith("_astro/") ? "public, max-age=31536000, immutable" : "public, max-age=60";
}

function page(status: number, title: string, text: string): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem;background:#f7f8f3;color:#14241b;text-align:center"><main><h1 style="font-weight:600">${title}</h1><p>${text}</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...securityHeaders("page"),
    },
  });
}

const notFound = () => page(404, "Página não encontrada", "Confira o endereço digitado.");

async function readJson(env: Env, key: string): Promise<Record<string, unknown> | null> {
  const raw = await env.HOSTING.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The site's live deploy and state: KV first, then the R2 pointer of sites before KV. */
export async function siteRecord(env: Env, subdomain: string): Promise<SiteRecord | null> {
  const record = await readJson(env, `site:${subdomain}`);
  if (record) {
    const { version, state, canonicalHost } = record;
    if (
      typeof version !== "string" ||
      !VERSION.test(version) ||
      !STATES.includes(state as SiteState)
    ) {
      return null;
    }
    return {
      version,
      state: state as SiteState,
      ...(typeof canonicalHost === "string" && HOST.test(canonicalHost) ? { canonicalHost } : {}),
    };
  }
  const pointer = await env.SITES.get(`sites/${subdomain}/current`);
  const deploy = pointer ? (await pointer.text()).trim() : "";
  return VERSION.test(deploy) ? { version: deploy, state: "active" } : null;
}

const suspended = () =>
  page(503, "Site indisponível", "Este site está temporariamente fora do ar.");
const offline = () => page(410, "Site fora do ar", "Este site não está mais no ar.");

/** A site's page or file by path (the testing address), or the page for its state. */
async function serveSite(
  request: Request,
  env: Env,
  subdomain: string,
  pathname: string,
): Promise<Response | null> {
  const record = await siteRecord(env, subdomain);
  if (!record) return null;
  if (record.state === "suspended") return suspended();
  if (record.state === "offline") return offline();
  return serveFile(request, env, subdomain, record.version, pathname);
}

/** A permanent redirect to the same path and query on another host. */
function moved(url: URL, host: string): Response {
  return new Response(null, {
    status: 308,
    headers: {
      location: `https://${host}${url.pathname}${url.search}`,
      "cache-control": "no-store",
    },
  });
}

/**
 * A site's page or file, or the page for its state; null when the site does not exist. One
 * canonical address (E25): when the client's own domain is the main one, the BrotaSites address
 * redirects to it; when it is not, the own domain redirects to the BrotaSites address. A
 * suspended or offline site shows its page wherever it is asked, without redirecting.
 */
async function serveHost(
  request: Request,
  env: Env,
  subdomain: string,
  url: URL,
  via: "base" | "domain",
): Promise<Response | null> {
  const record = await siteRecord(env, subdomain);
  if (!record) return null;
  if (record.state === "suspended") return suspended();
  if (record.state === "offline") return offline();
  const host = url.hostname.toLowerCase();
  if (via === "base" && record.canonicalHost && record.canonicalHost !== host) {
    return moved(url, record.canonicalHost);
  }
  if (via === "domain" && record.canonicalHost !== host) {
    return moved(url, `${subdomain}.${env.BASE_DOMAIN}`);
  }
  return serveFile(request, env, subdomain, record.version, url.pathname);
}

/** A client domain's KV record: the subdomain it serves, or the www host its root goes to. */
export function parseDomainRecord(
  raw: string | null,
): { subdomain: string; redirectTo?: string } | null {
  if (!raw) return null;
  if (SUBDOMAIN.test(raw)) return { subdomain: raw };
  try {
    const value = JSON.parse(raw) as { subdomain?: unknown; redirectTo?: unknown };
    if (typeof value.subdomain !== "string" || !SUBDOMAIN.test(value.subdomain)) return null;
    return typeof value.redirectTo === "string" && HOST.test(value.redirectTo)
      ? { subdomain: value.subdomain, redirectTo: value.redirectTo }
      : { subdomain: value.subdomain };
  } catch {
    return null;
  }
}

/** Serves one file of a deploy, or null when it does not exist. */
async function serveFile(
  request: Request,
  env: Env,
  subdomain: string,
  deploy: string,
  pathname: string,
): Promise<Response | null> {
  const keys = candidateKeys(pathname);
  if (!keys) return null;
  for (const key of keys) {
    const object = await env.SITES.get(`sites/${subdomain}/${deploy}/${key}`);
    if (!object) continue;
    const headers = new Headers(securityHeaders(policyFor(object.customMetadata)));
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", cacheControl(key));
    if (request.headers.get("if-none-match") === object.httpEtag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(request.method === "HEAD" ? null : object.body, { headers });
  }
  return null;
}

/** A file of a private preview: "/<site id>/<token>/<path>", or null. */
export async function servePreview(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response | null> {
  const [, siteId = "", token = "", ...rest] = pathname.split("/");
  if (!SITE_ID.test(siteId) || !PREVIEW_TOKEN.test(token)) return null;
  // Only the token the jobs recorded for this site opens it, and only until it expires.
  const record = await readJson(env, `preview:${siteId}`);
  if (
    record?.token !== token ||
    typeof record.expiresAt !== "string" ||
    !(Date.parse(record.expiresAt) > Date.now())
  ) {
    return null;
  }
  const keys = candidateKeys(`/${rest.join("/")}`);
  if (!keys) return null;
  for (const key of keys) {
    const object = await env.SITES.get(`previews/${siteId}/${token}/${key}`);
    if (!object) continue;
    const headers = new Headers(securityHeaders(policyFor(object.customMetadata)));
    object.writeHttpMetadata(headers);
    headers.set("cache-control", "private, no-store");
    headers.set("x-robots-tag", "noindex, nofollow");
    headers.set("referrer-policy", "no-referrer");
    return new Response(request.method === "HEAD" ? null : object.body, { headers });
  }
  return null;
}

/** Testing address: /<subdomain>/... picks the site; other paths use the site cookie. */
async function servePathMode(request: Request, env: Env, url: URL): Promise<Response> {
  const [, first = "", ...rest] = url.pathname.split("/");
  if (SUBDOMAIN.test(first) && (await siteRecord(env, first))) {
    if (rest.length === 0) {
      // "/padaria-do-ze" → "/padaria-do-ze/", so relative links resolve inside the site.
      return Response.redirect(`${url.origin}/${first}/${url.search}`, 301);
    }
    const response = await serveSite(request, env, first, `/${rest.join("/")}`);
    if (!response) return notFound();
    if (!response.ok && response.status !== 304) return response;
    const headers = new Headers(response.headers);
    headers.set("x-robots-tag", "noindex");
    // Files are cached per URL, so a cookie-dependent answer must not be shared.
    headers.set("cache-control", "no-store");
    headers.append("set-cookie", `${SITE_COOKIE}=${first}; Path=/; Secure; HttpOnly; SameSite=Lax`);
    return new Response(response.body, { status: response.status, headers });
  }

  const site = cookieSite(request);
  if (site) {
    const response = await serveSite(request, env, site, url.pathname);
    if (response?.ok) {
      const headers = new Headers(response.headers);
      headers.set("x-robots-tag", "noindex");
      headers.set("cache-control", "no-store");
      headers.set("vary", "cookie");
      return new Response(response.body, { status: response.status, headers });
    }
  }
  if (url.pathname === "/") {
    return page(
      200,
      "Ambiente de teste da BrotaSites",
      "Abra um site pelo endereço, por exemplo /nome-do-site/.",
    );
  }
  return notFound();
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** HMAC-SHA256 of "<subdomain>.<expiry>", as the platform signs it (lib/server/hosting.ts). */
export async function exportSignature(secret: string, subdomain: string, expires: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${subdomain}.${expires}`)),
  );
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

/** The .zip of a site's live deploy, for a link the platform signed: /_export/<subdomain>. */
export async function serveExport(env: Env, url: URL, pathname: string): Promise<Response> {
  const subdomain = pathname.replace(/^\/_export\//, "");
  const expires = Number(url.searchParams.get("exp"));
  const signature = url.searchParams.get("sig") ?? "";
  const now = Math.floor(Date.now() / 1000);
  if (
    !env.EXPORT_SECRET ||
    !SUBDOMAIN.test(subdomain) ||
    !Number.isInteger(expires) ||
    expires < now ||
    expires > now + EXPORT_MAX_SECONDS ||
    !sameText(signature, await exportSignature(env.EXPORT_SECRET, subdomain, expires))
  ) {
    return page(403, "Link expirado", "Peça um novo link de download no seu painel.");
  }
  const record = await siteRecord(env, subdomain);
  const object = record && (await env.SITES.get(`exports/${subdomain}/${record.version}.zip`));
  if (!object) return notFound();
  return new Response(object.body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${subdomain}.zip"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * HSTS on the production addresses only (E28, docs/security.md): HTTPS responses on the sites'
 * domain, with its subdomains; on a client's own domain without includeSubDomains, since the
 * client's other subdomains are not ours to decide. Never on the testing address. No preload.
 */
export function withHsts(response: Response, url: URL, env: Env): Response {
  if (url.protocol !== "https:" || isTestHost(url.hostname)) return response;
  const host = url.hostname.toLowerCase();
  const ours = host === env.BASE_DOMAIN || host.endsWith(`.${env.BASE_DOMAIN}`);
  const value = ours ? "max-age=31536000; includeSubDomains" : "max-age=31536000";
  const copy = new Response(response.body, response);
  copy.headers.set("strict-transport-security", value);
  return copy;
  // (Before E28 every response carried "max-age=31536000; includeSubDomains", a client's own
  // domain and plain HTTP included; securityHeaders no longer sets it.)
}

/** The sites' domain itself and its www: to the platform, path and query kept (301). */
function platformRedirect(url: URL, env: Env): Response | null {
  const host = url.hostname.toLowerCase();
  if (host !== env.BASE_DOMAIN && host !== `www.${env.BASE_DOMAIN}`) return null;
  let platform: URL;
  try {
    platform = new URL(env.PLATFORM_URL ?? "");
  } catch {
    return notFound();
  }
  return new Response(null, {
    status: 301,
    headers: {
      location: `${platform.origin}${url.pathname}${url.search}`,
      "cache-control": "public, max-age=3600",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    return withHsts(await route(request, env, url), url, env);
  },
} satisfies ExportedHandler<Env>;

/** Everything the Worker answers, before the HSTS header. */
async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const preview = (pathname: string) =>
    servePreview(request, env, pathname).then((response) => response ?? notFound());
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Método não permitido.", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }
  const previewOrExport = (pathname: string) =>
    pathname.startsWith("/_export/") ? serveExport(env, url, pathname) : preview(pathname);
  if (isTestHost(url.hostname)) {
    if (url.pathname.startsWith(`/${PREVIEW_HOST}/`)) {
      return previewOrExport(url.pathname.slice(PREVIEW_HOST.length + 1));
    }
    return servePathMode(request, env, url);
  }
  if (url.hostname === `${PREVIEW_HOST}.${env.BASE_DOMAIN}`) {
    return previewOrExport(url.pathname);
  }
  const toPlatform = platformRedirect(url, env);
  if (toPlatform) return toPlatform;

  // A client's site on the base domain, or on their own domain (Cloudflare for SaaS).
  const host = url.hostname.toLowerCase();
  const subdomain = siteFromHost(host, env.BASE_DOMAIN);
  if (subdomain) return (await serveHost(request, env, subdomain, url, "base")) ?? notFound();
  // An unknown host gets the same 404 as a missing page: nothing says which domains exist.
  if (host.endsWith(`.${env.BASE_DOMAIN}`) || !HOST.test(host)) return notFound();
  const mapped = parseDomainRecord(await env.HOSTING.get(`domain:${host}`));
  if (!mapped) return notFound();
  if (mapped.redirectTo) return moved(url, mapped.redirectTo);
  return (await serveHost(request, env, mapped.subdomain, url, "domain")) ?? notFound();
}
