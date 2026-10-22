// Serves every client site from the R2 bucket, in one of two ways:
//
// - Domain mode (production): <subdomain>.<SITES_DOMAIN> serves that client's site.
// - Path mode (testing, before the domain exists): on the Worker's free *.workers.dev
//   address, /<subdomain>/ serves that site. The page sets a cookie with the site it
//   belongs to, so files the site asks for by absolute path (/_astro/...) are found too.
//
// Layout in the bucket (written by the generation worker, packages/generator/src/r2.ts):
//   sites/<subdomain>/current            the id of the live deploy (plain text)
//   sites/<subdomain>/<deploy id>/...    the files of that deploy
// A new deploy is uploaded in full before `current` changes, so visitors never see a
// half-updated site.

export interface Env {
  SITES: R2Bucket;
  SITES_DOMAIN: string;
}

const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;
const TEST_HOST_SUFFIX = ".workers.dev";
const SITE_COOKIE = "brotasites_site";

const securityHeaders: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "strict-transport-security": "max-age=31536000",
};

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
      ...securityHeaders,
    },
  });
}

const notFound = () => page(404, "Página não encontrada", "Confira o endereço digitado.");

async function liveDeploy(env: Env, subdomain: string): Promise<string | null> {
  const pointer = await env.SITES.get(`sites/${subdomain}/current`);
  const deploy = pointer ? (await pointer.text()).trim() : "";
  return /^[\w-]+$/.test(deploy) ? deploy : null;
}

/** Serves one file of a site's live deploy, or null when it does not exist. */
async function serveFile(
  request: Request,
  env: Env,
  subdomain: string,
  pathname: string,
): Promise<Response | null> {
  const keys = candidateKeys(pathname);
  const deploy = keys && (await liveDeploy(env, subdomain));
  if (!keys || !deploy) return null;
  for (const key of keys) {
    const object = await env.SITES.get(`sites/${subdomain}/${deploy}/${key}`);
    if (!object) continue;
    const headers = new Headers(securityHeaders);
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

/** Testing address: /<subdomain>/... picks the site; other paths use the site cookie. */
async function servePathMode(request: Request, env: Env, url: URL): Promise<Response> {
  const [, first = "", ...rest] = url.pathname.split("/");
  if (SUBDOMAIN.test(first) && (await liveDeploy(env, first))) {
    if (rest.length === 0) {
      // "/padaria-do-ze" → "/padaria-do-ze/", so relative links resolve inside the site.
      return Response.redirect(`${url.origin}/${first}/${url.search}`, 301);
    }
    const response = await serveFile(request, env, first, `/${rest.join("/")}`);
    if (!response) return notFound();
    const headers = new Headers(response.headers);
    headers.set("x-robots-tag", "noindex");
    // Files are cached per URL, so a cookie-dependent answer must not be shared.
    headers.set("cache-control", "no-store");
    headers.append("set-cookie", `${SITE_COOKIE}=${first}; Path=/; Secure; HttpOnly; SameSite=Lax`);
    return new Response(response.body, { status: response.status, headers });
  }

  const site = cookieSite(request);
  if (site) {
    const response = await serveFile(request, env, site, url.pathname);
    if (response) {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Método não permitido.", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }
    const url = new URL(request.url);
    if (isTestHost(url.hostname)) return servePathMode(request, env, url);

    const subdomain = siteFromHost(url.hostname, env.SITES_DOMAIN);
    if (!subdomain) return notFound();
    return (await serveFile(request, env, subdomain, url.pathname)) ?? notFound();
  },
} satisfies ExportedHandler<Env>;
