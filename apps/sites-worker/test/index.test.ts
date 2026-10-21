import { describe, expect, it } from "vitest";
import worker, { candidateKeys, type Env, siteFromHost } from "../src/index";

/** An in-memory stand-in for the R2 bucket binding. */
function bucket(files: Record<string, { body: string; type?: string }>): R2Bucket {
  return {
    async get(key: string) {
      const file = files[key];
      if (!file) return null;
      return {
        httpEtag: `"${key.length}"`,
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
