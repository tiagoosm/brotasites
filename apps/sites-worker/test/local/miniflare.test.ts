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
  worker.fetch(`http://${host}${path}`, { headers: { host } });

describe("sites Worker in Miniflare", () => {
  it("serves the version KV points to, with the strict headers", async () => {
    const response = await get("padaria-do-ze.sites.localhost");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<h1>Versão 2</h1>");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=");
  });

  it("serves a custom domain and keeps a suspended site off", async () => {
    expect(await (await get("www.padariadoze.com.br")).text()).toBe("<h1>Versão 2</h1>");
    const suspended = await get("loja.sites.localhost");
    expect(suspended.status).toBe(503);
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
