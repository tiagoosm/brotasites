// Serves every client site: <subdomain>.<SITES_DOMAIN> is read from the R2 bucket.
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

function cacheControl(key: string): string {
  // Astro fingerprints everything in _astro/, so those files never change.
  return key.startsWith("_astro/") ? "public, max-age=31536000, immutable" : "public, max-age=60";
}

function notFound(): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Página não encontrada</title></head><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem;background:#f7f8f3;color:#14241b;text-align:center"><main><h1 style="font-weight:600">Página não encontrada</h1><p>Confira o endereço digitado.</p></main></body></html>`;
  return new Response(html, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...securityHeaders,
    },
  });
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
    const subdomain = siteFromHost(url.hostname, env.SITES_DOMAIN);
    const keys = candidateKeys(url.pathname);
    if (!subdomain || !keys) return notFound();

    const pointer = await env.SITES.get(`sites/${subdomain}/current`);
    const deploy = pointer ? (await pointer.text()).trim() : "";
    if (!/^[\w-]+$/.test(deploy)) return notFound();

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
    return notFound();
  },
} satisfies ExportedHandler<Env>;
