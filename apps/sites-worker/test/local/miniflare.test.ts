import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy, type Unstable_DevWorker, unstable_dev } from "wrangler";
import { type Env, exportSignature } from "../../src/index";

// The Worker as it runs on Cloudflare, locally: wrangler bundles it and runs it in Miniflare
// (workerd) with local R2 and KV, which this test fills first (docs/hosting.md). No account,
// no network.

const SECRET = "segredo-local";
let persist: string;
let worker: Unstable_DevWorker;

beforeAll(async () => {
  persist = await mkdtemp(join(tmpdir(), "brotasites-worker-"));
  // wrangler dev keeps its state in <persistTo>/v3; the proxy is pointed at that folder.
  const proxy = await getPlatformProxy<Env>({
    configPath: "wrangler.jsonc",
    persist: { path: join(persist, "v3") },
  });
  const { SITES, HOSTING } = proxy.env;
  await SITES.put("sites/padaria-do-ze/v1/index.html", "<h1>Versão 1</h1>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
    customMetadata: { csp: "strict" },
  });
  await SITES.put("sites/padaria-do-ze/v2/index.html", "<h1>Versão 2</h1>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
    customMetadata: { csp: "strict" },
  });
  await SITES.put("exports/padaria-do-ze/v2.zip", "PK-local");
  await HOSTING.put(
    "site:padaria-do-ze",
    JSON.stringify({ version: "v2", previous: "v1", state: "active" }),
  );
  await HOSTING.put("site:loja", JSON.stringify({ version: "v1", state: "suspended" }));
  await HOSTING.put("domain:www.padariadoze.com.br", "padaria-do-ze");
  // E25: a site whose own domain is the main address, with the root of the www pair.
  await SITES.put("sites/casa-verde/v1/index.html", "<h1>Casa Verde</h1>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
    customMetadata: { csp: "strict" },
  });
  await HOSTING.put(
    "site:casa-verde",
    JSON.stringify({ version: "v1", state: "active", canonicalHost: "www.casaverde.com.br" }),
  );
  await HOSTING.put("domain:www.casaverde.com.br", "casa-verde");
  await HOSTING.put(
    "domain:casaverde.com.br",
    JSON.stringify({ subdomain: "casa-verde", redirectTo: "www.casaverde.com.br" }),
  );
  await HOSTING.put("domain:www.lojasuspensa.com.br", "loja");
  await proxy.dispose();
  worker = await unstable_dev("src/index.ts", {
    config: "wrangler.jsonc",
    persistTo: persist,
    vars: { EXPORT_SECRET: SECRET },
    logLevel: "none",
    experimental: { disableExperimentalWarning: true },
  });
}, 120_000);

afterAll(async () => {
  await worker?.stop();
  await rm(persist, { recursive: true, force: true });
});

const get = (host: string, path = "/") =>
  worker.fetch(`http://${host}${path}`, { headers: { host }, redirect: "manual" });

describe("sites Worker in Miniflare", () => {
  it("serves the version KV points to, with the strict headers", async () => {
    const response = await get("padaria-do-ze.sites.localhost");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<h1>Versão 2</h1>");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=");
  });

  it("serves a custom domain and keeps a suspended site off", async () => {
    // The BrotaSites address is the main one here: the own domain redirects to it (E25).
    const own = await get("www.padariadoze.com.br", "/cardapio");
    expect(own.status).toBe(308);
    expect(own.headers.get("location")).toBe("https://padaria-do-ze.sites.localhost/cardapio");
    const suspended = await get("loja.sites.localhost");
    expect(suspended.status).toBe(503);
    expect((await get("www.lojasuspensa.com.br")).status).toBe(503);
  });

  it("serves the own domain when it is the main address, and the www pair (E25)", async () => {
    const own = await get("www.casaverde.com.br");
    expect(own.status).toBe(200);
    expect(await own.text()).toBe("<h1>Casa Verde</h1>");
    expect(own.headers.get("content-security-policy")).toBe(
      (await get("padaria-do-ze.sites.localhost")).headers.get("content-security-policy"),
    );
    const base = await get("casa-verde.sites.localhost", "/sobre");
    expect(base.status).toBe(308);
    expect(base.headers.get("location")).toBe("https://www.casaverde.com.br/sobre");
    const root = await get("casaverde.com.br");
    expect(root.status).toBe(308);
    expect(root.headers.get("location")).toBe("https://www.casaverde.com.br/");
    // Removed (no KV record): the same 404 as an unknown host.
    expect((await get("www.removido.com.br")).status).toBe(404);
  });

  it("hands over the export with a valid signature only", async () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const sig = await exportSignature(SECRET, "padaria-do-ze", exp);
    const ok = await get("previa.sites.localhost", `/_export/padaria-do-ze?exp=${exp}&sig=${sig}`);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("PK-local");
    const bad = await get("previa.sites.localhost", `/_export/padaria-do-ze?exp=${exp}&sig=00`);
    expect(bad.status).toBe(403);
  });
});
