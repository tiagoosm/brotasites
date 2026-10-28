import { describe, expect, it } from "vitest";
import worker, { candidateKeys, type Env, exportSignature, siteFromHost } from "../src/index";

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

/** An in-memory stand-in for the KV binding. */
function kv(values: Record<string, string>): KVNamespace {
  return { get: async (key: string) => values[key] ?? null } as unknown as KVNamespace;
}

const PREVIEW_SITE = "0b6f2a4e-5c1d-4e8a-9f3b-2d7c6a1e4b90";
const PREVIEW_TOKEN = "tok_abcdefghijklmnopqrstuvwxyz012345";
const later = new Date(Date.now() + 86_400_000).toISOString();

const values: Record<string, string> = {
  [`preview:${PREVIEW_SITE}`]: JSON.stringify({ token: PREVIEW_TOKEN, expiresAt: later }),
  "site:oficina-nova": JSON.stringify({ version: "v1", previous: "v0", state: "active" }),
  "site:loja-suspensa": JSON.stringify({ version: "v1", state: "suspended" }),
  "site:loja-antiga": JSON.stringify({ version: "v1", state: "offline" }),
  "site:loja-carencia": JSON.stringify({ version: "v1", state: "grace" }),
  "domain:www.oficinanova.com.br": "oficina-nova",
};

const env: Env = {
  BASE_DOMAIN: "brotasites.com",
  EXPORT_SECRET: "segredo-de-teste",
  HOSTING: kv(values),
  SITES: bucket({
    "sites/padaria-do-ze/current": { body: "d2\n" },
    "sites/padaria-do-ze/d1/index.html": { body: "versão antiga", type: "text/html" },
    "sites/padaria-do-ze/d2/index.html": { body: "<h1>Padaria do Zé</h1>", type: "text/html" },
    "sites/padaria-do-ze/d2/_astro/site.abc.css": { body: "body{}", type: "text/css" },
    "sites/padaria-do-ze/d2/cardapio/index.html": { body: "cardápio", type: "text/html" },
    [`previews/${PREVIEW_SITE}/${PREVIEW_TOKEN}/index.html`]: {
      body: "<h1>Prévia</h1>",
      type: "text/html",
      customMetadata: { csp: "strict" },
    },
    "sites/oficina-nova/v0/index.html": { body: "versão anterior", type: "text/html" },
    "exports/oficina-nova/v1.zip": { body: "PK-zip", type: "application/zip" },
    "sites/loja-suspensa/v1/index.html": { body: "<h1>Loja</h1>", type: "text/html" },
    "sites/loja-antiga/v1/index.html": { body: "<h1>Loja</h1>", type: "text/html" },
    "sites/loja-carencia/v1/index.html": { body: "<h1>Ainda no ar</h1>", type: "text/html" },
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

describe("hosting records in KV (E12)", () => {
  it("serves the version KV points to, and sites published before KV from R2", async () => {
    expect(await (await get("https://oficina-nova.brotasites.com/")).text()).toBe(
      "<h1>Oficina</h1>",
    );
    expect(await (await get("https://padaria-do-ze.brotasites.com/")).text()).toBe(
      "<h1>Padaria do Zé</h1>",
    );
  });

  it("shows a neutral page for suspended sites and says when a site left", async () => {
    const paused = await get("https://loja-suspensa.brotasites.com/");
    expect(paused.status).toBe(503);
    expect(await paused.text()).toContain("temporariamente fora do ar");
    expect(paused.headers.get("cache-control")).toBe("no-store");
    const gone = await get("https://loja-antiga.brotasites.com/");
    expect(gone.status).toBe(410);
    // On the testing address too, without setting the site cookie.
    const test = await get("https://brotasites-sites.conta.workers.dev/loja-suspensa/");
    expect(test.status).toBe(503);
    expect(test.headers.get("set-cookie")).toBeNull();
  });

  it("keeps a site in its grace period online", async () => {
    const response = await get("https://loja-carencia.brotasites.com/");
    expect(response.status).toBe(200);
  });

  it("serves a client's own domain from the KV map, and nothing for unknown domains", async () => {
    expect(await (await get("https://www.oficinanova.com.br/")).text()).toBe("<h1>Oficina</h1>");
    expect((await get("https://www.outrodominio.com.br/")).status).toBe(404);
    // A subdomain of the base domain is never looked up as a custom domain.
    expect((await get("https://x.y.brotasites.com/")).status).toBe(404);
  });

  it("opens a preview only with the recorded token, before it expires", async () => {
    const path = `/${PREVIEW_SITE}/${PREVIEW_TOKEN}/`;
    expect((await get(`https://previa.brotasites.com${path}`)).status).toBe(200);
    const expired: Env = {
      ...env,
      HOSTING: kv({
        ...values,
        [`preview:${PREVIEW_SITE}`]: JSON.stringify({
          token: PREVIEW_TOKEN,
          expiresAt: "2020-01-01T00:00:00Z",
        }),
      }),
    };
    expect(
      (await worker.fetch(new Request(`https://previa.brotasites.com${path}`), expired)).status,
    ).toBe(404);
    const unknown: Env = { ...env, HOSTING: kv({}) };
    expect(
      (await worker.fetch(new Request(`https://previa.brotasites.com${path}`), unknown)).status,
    ).toBe(404);
  });

  it("hands the .zip of the live version over a signed, short-lived link", async () => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    const sig = await exportSignature("segredo-de-teste", "oficina-nova", exp);
    const response = await get(
      `https://previa.brotasites.com/_export/oficina-nova?exp=${exp}&sig=${sig}`,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("PK-zip");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="oficina-nova.zip"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");

    const bad = [
      `exp=${exp}&sig=${sig.replace(/^./, sig[0] === "a" ? "b" : "a")}`,
      `exp=${exp + 1}&sig=${sig}`,
      `exp=${exp + 7200}&sig=${await exportSignature("segredo-de-teste", "oficina-nova", exp + 7200)}`,
      `exp=${exp - 3600}&sig=${await exportSignature("segredo-de-teste", "oficina-nova", exp - 3600)}`,
    ];
    for (const query of bad) {
      expect(
        (await get(`https://previa.brotasites.com/_export/oficina-nova?${query}`)).status,
        query,
      ).toBe(403);
    }
    const other = await exportSignature("segredo-de-teste", "padaria-do-ze", exp);
    expect(
      (await get(`https://previa.brotasites.com/_export/oficina-nova?exp=${exp}&sig=${other}`))
        .status,
    ).toBe(403);
    const noSecret: Env = { ...env, EXPORT_SECRET: undefined };
    const off = await worker.fetch(
      new Request(`https://previa.brotasites.com/_export/oficina-nova?exp=${exp}&sig=${sig}`),
      noSecret,
    );
    expect(off.status).toBe(403);
  });
});
