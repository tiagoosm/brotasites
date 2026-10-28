import { describe, expect, it } from "vitest";
import worker, { candidateKeys, type Env, siteFromHost } from "../src/index";

/** An in-memory stand-in for the R2 bucket binding. */
function bucket(
  files: Record<string, { body: string; type?: string; customMetadata?: Record<string, string> }>,
): R2Bucket {
  return {
    async get(key: string) {
      const file = files[key];
      if (!file) return null;
      return {
        httpEtag: `"${key.length}"`,
        customMetadata: file.customMetadata,
        body: new Response(file.body).body,
        text: async () => file.body,
        writeHttpMetadata(headers: Headers) {
          if (file.type) headers.set("content-type", file.type);
        },
      };
    },
  } as unknown as R2Bucket;
}

const env: Env = {
  SITES_DOMAIN: "brotasites.com",
  SITES: bucket({
    "sites/padaria-do-ze/current": { body: "d2\n" },
    "sites/padaria-do-ze/d1/index.html": { body: "versão antiga", type: "text/html" },
    "sites/padaria-do-ze/d2/index.html": { body: "<h1>Padaria do Zé</h1>", type: "text/html" },
    "sites/padaria-do-ze/d2/_astro/site.abc.css": { body: "body{}", type: "text/css" },
    "sites/padaria-do-ze/d2/cardapio/index.html": { body: "cardápio", type: "text/html" },
    "previews/0b6f2a4e-5c1d-4e8a-9f3b-2d7c6a1e4b90/tok_abcdefghijklmnopqrstuvwxyz012345/index.html":
      {
        body: "<h1>Prévia</h1>",
        type: "text/html",
        customMetadata: { csp: "strict" },
      },
    "sites/oficina-nova/current": { body: "v1" },
    "sites/oficina-nova/v1/index.html": {
      body: "<h1>Oficina</h1>",
      type: "text/html",
      customMetadata: { csp: "strict" },
    },
  }),
};

const get = (url: string, init?: RequestInit) => worker.fetch(new Request(url, init), env);

describe("sites worker", () => {
  it("serves the live deploy of the site named by the host", async () => {
    const response = await get("https://padaria-do-ze.brotasites.com/");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<h1>Padaria do Zé</h1>");
    expect(response.headers.get("content-type")).toBe("text/html");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("caches fingerprinted assets for a year", async () => {
    const response = await get("https://padaria-do-ze.brotasites.com/_astro/site.abc.css");
    expect(response.headers.get("cache-control")).toContain("immutable");
  });

  it("finds pages without the trailing slash", async () => {
    const response = await get("https://padaria-do-ze.brotasites.com/cardapio");
    expect(await response.text()).toBe("cardápio");
  });

  it("answers 304 when the browser already has the file", async () => {
    const first = await get("https://padaria-do-ze.brotasites.com/");
    const etag = first.headers.get("etag") ?? "";
    const again = await get("https://padaria-do-ze.brotasites.com/", {
      headers: { "if-none-match": etag },
    });
    expect(again.status).toBe(304);
  });

  it("shows a Portuguese 404 for unknown sites, pages and hosts", async () => {
    for (const url of [
      "https://outro.brotasites.com/",
      "https://padaria-do-ze.brotasites.com/nada",
      "https://exemplo.com/",
    ]) {
      const response = await get(url);
      expect(response.status, url).toBe(404);
      expect(await response.text()).toContain("Página não encontrada");
    }
  });

  it("only reads", async () => {
    const response = await get("https://padaria-do-ze.brotasites.com/", { method: "POST" });
    expect(response.status).toBe(405);
  });
});

describe("paths and hosts", () => {
  it("never leaves the site's folder", () => {
    expect(candidateKeys("/../outro/index.html")).toBeNull();
    expect(candidateKeys("/%2e%2e/segredo")).toBeNull();
    expect(candidateKeys("/%E0%A4%A")).toBeNull();
    expect(candidateKeys("/")).toEqual(["index.html"]);
    expect(candidateKeys("/fotos/")).toEqual(["fotos/index.html"]);
  });

  it("accepts only one-level client subdomains", () => {
    expect(siteFromHost("padaria-do-ze.brotasites.com", "brotasites.com")).toBe("padaria-do-ze");
    expect(siteFromHost("a.b.brotasites.com", "brotasites.com")).toBeNull();
    expect(siteFromHost("brotasites.com", "brotasites.com")).toBeNull();
    expect(siteFromHost("padaria.exemplo.com", "brotasites.com")).toBeNull();
  });
});

describe("test address (workers.dev)", () => {
  const TEST = "https://brotasites-sites.conta.workers.dev";

  it("opens a site by its path and remembers it in a cookie", async () => {
    const response = await get(`${TEST}/padaria-do-ze/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<h1>Padaria do Zé</h1>");
    expect(response.headers.get("set-cookie")).toContain("brotasites_site=padaria-do-ze");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("adds the slash so links inside the site work", async () => {
    const response = await get(`${TEST}/padaria-do-ze`);
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(`${TEST}/padaria-do-ze/`);
  });

  it("finds the site's own files, asked by absolute path, through the cookie", async () => {
    const cookie = { headers: { cookie: "outro=1; brotasites_site=padaria-do-ze" } };
    const css = await get(`${TEST}/_astro/site.abc.css`, cookie);
    expect(await css.text()).toBe("body{}");
    expect(css.headers.get("cache-control")).toBe("no-store");
    expect((await get(`${TEST}/padaria-do-ze/cardapio`)).status).toBe(200);
    // Without the cookie there is no way to know the site.
    expect((await get(`${TEST}/_astro/site.abc.css`)).status).toBe(404);
  });

  it("explains itself at the root and refuses unknown sites", async () => {
    const root = await get(`${TEST}/`);
    expect(await root.text()).toContain("Ambiente de teste da BrotaSites");
    expect((await get(`${TEST}/outro-site/`)).status).toBe(404);
    const bad = await get(`${TEST}/_astro/x.css`, { headers: { cookie: "brotasites_site=../x" } });
    expect(bad.status).toBe(404);
  });
});

describe("security headers on responses", () => {
  it("send the strict policy for 1.2 sites and the legacy one for 1.1 sites", async () => {
    const strict = await get("https://oficina-nova.brotasites.com/");
    expect(strict.status).toBe(200);
    expect(strict.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(strict.headers.get("content-security-policy")).not.toContain("unsafe-inline");
    const legacy = await get("https://padaria-do-ze.brotasites.com/");
    expect(legacy.headers.get("content-security-policy")).toContain("'unsafe-inline'");
    expect(legacy.headers.get("permissions-policy")).toContain("camera=()");
  });

  it("send them on the not-found page too", async () => {
    const response = await get("https://padaria-do-ze.brotasites.com/nao-existe.png");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-security-policy")).toContain("script-src 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("private previews", () => {
  const path = "/0b6f2a4e-5c1d-4e8a-9f3b-2d7c6a1e4b90/tok_abcdefghijklmnopqrstuvwxyz012345/";

  it("serves a preview with its token, never indexed, cached or leaking the address", async () => {
    const response = await get(`https://previa.brotasites.com${path}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<h1>Prévia</h1>");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
  });

  it("refuses a wrong token, a malformed id and the preview prefix on site hosts", async () => {
    expect(
      (
        await get(
          "https://previa.brotasites.com/0b6f2a4e-5c1d-4e8a-9f3b-2d7c6a1e4b90/tok_wrongwrongwrongwrongwrongwrong0000/",
        )
      ).status,
    ).toBe(404);
    expect((await get("https://previa.brotasites.com/../sites/padaria-do-ze/current")).status).toBe(
      404,
    );
    expect((await get(`https://padaria-do-ze.brotasites.com/previews${path}`)).status).toBe(404);
  });

  it("serves previews on the testing address under /previa/", async () => {
    const response = await get(`https://brotasites-sites.conta.workers.dev/previa${path}`);
    expect(response.status).toBe(200);
  });
});
