import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SiteConfig } from "@brotasites/schema";
import { afterAll, describe, expect, it } from "vitest";
import {
  type KvOptions,
  PREVIEW_DAYS,
  publishVersion,
  putPreviewRecord,
  readSiteRecord,
  rollbackSite,
  setSiteState,
} from "../src/kv.js";
import { deployToR2, uploadPreviewToR2 } from "../src/r2.js";
import { zipDir } from "../src/zip.js";

/** Workers KV through the Cloudflare API, in memory; R2 PUTs are recorded. */
function fakeCloudflare() {
  const kv = new Map<string, string>();
  const calls: { method: string; url: string; auth: string; ttl: string | null }[] = [];
  const r2Keys: string[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const auth = (init?.headers as Record<string, string>)?.authorization ?? "";
    if (url.hostname === "api.cloudflare.com") {
      calls.push({ method, url: url.pathname, auth, ttl: url.searchParams.get("expiration_ttl") });
      const key = decodeURIComponent(url.pathname.split("/values/")[1] ?? "");
      if (method === "PUT") {
        kv.set(key, String(init?.body));
        return new Response(JSON.stringify({ success: true }));
      }
      const value = kv.get(key);
      return value === undefined ? new Response("not found", { status: 404 }) : new Response(value);
    }
    r2Keys.push(decodeURIComponent(url.pathname));
    return new Response(null, { status: 200 });
  };
  const options: KvOptions = { accountId: "conta", namespaceId: "ns", apiToken: "token", fetch };
  return { kv, calls, r2Keys, options };
}

describe("site pointers in KV", () => {
  it("publishes versions, keeps the previous one and rolls back", async () => {
    const { options, calls, kv } = fakeCloudflare();
    await publishVersion(options, "padaria-do-ze", "v1");
    await publishVersion(options, "padaria-do-ze", "v2");
    expect(await readSiteRecord(options, "padaria-do-ze")).toMatchObject({
      version: "v2",
      previous: "v1",
      state: "active",
    });
    await rollbackSite(options, "padaria-do-ze");
    expect(JSON.parse(kv.get("site:padaria-do-ze") ?? "")).toMatchObject({
      version: "v1",
      previous: "v2",
    });
    expect(calls[0]).toMatchObject({
      url: "/client/v4/accounts/conta/storage/kv/namespaces/ns/values/site%3Apadaria-do-ze",
      auth: "Bearer token",
    });
  });

  it("never lifts a suspension by publishing", async () => {
    const { options } = fakeCloudflare();
    await publishVersion(options, "loja", "v1");
    await setSiteState(options, "loja", "suspended");
    const record = await publishVersion(options, "loja", "v2");
    expect(record).toMatchObject({ version: "v2", state: "suspended" });
    expect(await setSiteState(options, "nao-existe", "suspended")).toBeNull();
  });

  it("records the preview token with its expiry", async () => {
    const { options, kv, calls } = fakeCloudflare();
    await putPreviewRecord(options, "site-1", "tok", Date.parse("2026-10-28T00:00:00Z"));
    expect(JSON.parse(kv.get("preview:site-1") ?? "")).toEqual({
      token: "tok",
      expiresAt: "2026-11-27T00:00:00.000Z",
    });
    expect(calls[0]?.ttl).toBe(String(PREVIEW_DAYS * 24 * 3600));
  });
});

describe("deploy with KV", () => {
  let dir: string | undefined;
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("uploads the files and the zip export, then switches the pointer in KV", async () => {
    dir = await mkdtemp(join(tmpdir(), "brotasites-kv-"));
    await mkdir(join(dir, "_astro"));
    await writeFile(join(dir, "index.html"), "<h1>Padaria do Zé</h1>");
    await writeFile(join(dir, "_astro", "site.css"), "body{}");
    const { options, r2Keys, kv } = fakeCloudflare();
    const r2 = {
      accountId: "conta",
      accessKeyId: "chave",
      secretAccessKey: "segredo",
      bucket: "brotasites-sites",
      deployId: "d1",
      fetch: options.fetch,
      kv: options,
    };
    await deployToR2(dir, { site: { subdomain: "padaria-do-ze" } } as SiteConfig, r2);
    expect(r2Keys.sort()).toEqual([
      "/brotasites-sites/exports/padaria-do-ze/d1.zip",
      "/brotasites-sites/sites/padaria-do-ze/d1/_astro/site.css",
      "/brotasites-sites/sites/padaria-do-ze/d1/index.html",
    ]);
    expect(JSON.parse(kv.get("site:padaria-do-ze") ?? "")).toMatchObject({ version: "d1" });

    await uploadPreviewToR2(dir, "site-1", "tok_abcdefghijklmnopqrstuvwxyz012345", r2);
    expect(JSON.parse(kv.get("preview:site-1") ?? "").token).toBe(
      "tok_abcdefghijklmnopqrstuvwxyz012345",
    );
  });

  it("makes a zip that other tools open, with every file intact", async () => {
    const zipPath = join(dir as string, "..", "brotasites-test-export.zip");
    await writeFile(zipPath, await zipDir(dir as string));
    const listing = execFileSync(
      "python3",
      [
        "-c",
        "import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print('\\n'.join(f'{n}={z.read(n).decode()}' for n in z.namelist()))",
        zipPath,
      ],
      { encoding: "utf8" },
    );
    expect(listing.trim().split("\n")).toEqual([
      "_astro/site.css=body{}",
      "index.html=<h1>Padaria do Zé</h1>",
    ]);
    await rm(zipPath, { force: true });
  });
});
