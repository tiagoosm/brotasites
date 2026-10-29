import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SiteConfig } from "@brotasites/schema";
import { afterAll, describe, expect, it } from "vitest";
import { contentTypeFor, deployToR2, purgeSite, signS3, uploadPreviewToR2 } from "../src/r2.js";

describe("signS3", () => {
  // "Example: GET Object" from the AWS Signature Version 4 documentation for S3.
  it("matches the AWS reference signature", () => {
    const authorization = signS3({
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      headers: {
        range: "bytes=0-9",
        "x-amz-content-sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "x-amz-date": "20130524T000000Z",
      },
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });
    expect(authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
  });

  it("encodes keys the way S3 expects", () => {
    const sign = (path: string) =>
      signS3({
        method: "PUT",
        url: new URL(`https://b.s3.amazonaws.com${path}`),
        headers: { "x-amz-date": "20130524T000000Z", "x-amz-content-sha256": "x" },
        region: "auto",
        accessKeyId: "k",
        secretAccessKey: "s",
      });
    // An encoded and a raw key are the same object, so they must sign the same.
    expect(sign("/fotos/p%C3%A3o%20(1).jpg")).toBe(sign("/fotos/pão (1).jpg"));
  });
});

describe("deployToR2", () => {
  let dir: string | undefined;
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("uploads every file, then points the site to the new deploy", async () => {
    dir = await mkdtemp(join(tmpdir(), "brotasites-r2-"));
    await mkdir(join(dir, "_astro"));
    await writeFile(join(dir, "index.html"), "<h1>Padaria do Zé</h1>");
    await writeFile(join(dir, "_astro", "site.abc.css"), "body{}");

    const requests: { url: string; type: string; auth: string; body: string }[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      const headers = init?.headers as Record<string, string>;
      requests.push({
        url: String(input),
        type: headers["content-type"] ?? "",
        auth: headers.authorization ?? "",
        body: new TextDecoder().decode(init?.body as Uint8Array),
      });
      return new Response(null, { status: 200 });
    };
    const config = { site: { subdomain: "padaria-do-ze" } } as SiteConfig;
    const id = await deployToR2(dir, config, {
      accountId: "conta",
      accessKeyId: "chave",
      secretAccessKey: "segredo",
      bucket: "brotasites-sites",
      deployId: "d1",
      fetch: fakeFetch,
    });

    expect(id).toBe("d1");
    const base = "https://conta.r2.cloudflarestorage.com/brotasites-sites/sites/padaria-do-ze";
    expect(
      requests
        .slice(0, 2)
        .map((r) => r.url)
        .sort(),
    ).toEqual([`${base}/d1/_astro/site.abc.css`, `${base}/d1/index.html`]);
    expect(requests.find((r) => r.url.endsWith("index.html"))?.type).toBe(
      "text/html; charset=utf-8",
    );
    // The pointer is written last.
    expect(requests.at(-1)).toMatchObject({ url: `${base}/current`, body: "d1" });
    expect(requests[0]?.auth).toMatch(
      /^AWS4-HMAC-SHA256 Credential=chave\/\d{8}\/auto\/s3\/aws4_request/,
    );
  });

  it("marks the files of a strict-CSP site, but not the pointer", async () => {
    const metas: { url: string; csp: string | undefined }[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      const headers = init?.headers as Record<string, string>;
      metas.push({ url: String(input), csp: headers["x-amz-meta-csp"] });
      return new Response(null, { status: 200 });
    };
    await deployToR2(dir as string, { site: { subdomain: "padaria-do-ze" } } as SiteConfig, {
      accountId: "conta",
      accessKeyId: "chave",
      secretAccessKey: "segredo",
      bucket: "brotasites-sites",
      deployId: "d2",
      fetch: fakeFetch,
      strictCsp: true,
    });
    expect(metas.filter((m) => m.url.includes("/d2/")).every((m) => m.csp === "strict")).toBe(true);
    expect(metas.find((m) => m.url.endsWith("/current"))?.csp).toBeUndefined();
  });

  it("stops without switching when an upload fails", async () => {
    const urls: string[] = [];
    const failing: typeof fetch = async (input) => {
      urls.push(String(input));
      return new Response(null, { status: 403 });
    };
    await expect(
      deployToR2(dir as string, { site: { subdomain: "padaria-do-ze" } } as SiteConfig, {
        accountId: "conta",
        accessKeyId: "chave",
        secretAccessKey: "segredo",
        bucket: "brotasites-sites",
        fetch: failing,
      }),
    ).rejects.toThrow(/Falha ao enviar/);
    expect(urls.some((url) => url.endsWith("/current"))).toBe(false);
  });

  it("knows the types of a built site's files", () => {
    expect(contentTypeFor("_astro/a.woff2")).toBe("font/woff2");
    expect(contentTypeFor("foto.WEBP")).toBe("image/webp");
    expect(contentTypeFor("arquivo.xyz")).toBe("application/octet-stream");
  });
});

describe("uploadPreviewToR2", () => {
  it("puts the preview under previews/<site>/<token>/ with the strict CSP mark", async () => {
    const dir = await mkdtemp(join(tmpdir(), "brotasites-preview-"));
    await writeFile(join(dir, "index.html"), "<h1>Prévia</h1>");
    const requests: { url: string; meta: string }[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      const headers = init?.headers as Record<string, string>;
      requests.push({ url: String(input), meta: headers["x-amz-meta-csp"] ?? "" });
      return new Response(null, { status: 200 });
    };
    await uploadPreviewToR2(
      dir,
      "0b6f2a4e-5c1d-4e8a-9f3b-2d7c6a1e4b90",
      "tok_abcdefghijklmnopqrstuvwxyz012345",
      {
        accountId: "acc",
        accessKeyId: "k",
        secretAccessKey: "s",
        bucket: "b",
        fetch: fakeFetch,
      },
    );
    expect(requests).toEqual([
      {
        url: "https://acc.r2.cloudflarestorage.com/b/previews/0b6f2a4e-5c1d-4e8a-9f3b-2d7c6a1e4b90/tok_abcdefghijklmnopqrstuvwxyz012345/index.html",
        meta: "strict",
      },
    ]);
    await rm(dir, { recursive: true, force: true });
  });
});

describe("purgeSite", () => {
  it("lists every page of keys and deletes the site's versions, exports, previews and KV records", async () => {
    const calls: string[] = [];
    const listing: Record<string, string[][]> = {
      "previews/s1/": [["previews/s1/tok/index.html"]],
      "sites/padaria/": [
        ["sites/padaria/v1/index.html", "sites/padaria/v1/a&amp;b.css"],
        ["sites/padaria/v2/index.html"],
      ],
      "exports/padaria/": [["exports/padaria/v1.zip"]],
    };
    const fakeFetch = (async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      calls.push(
        `${method} ${url.hostname.startsWith("api.") ? "kv" : "r2"} ${decodeURIComponent(url.pathname)}`,
      );
      expect(new Headers(init?.headers).get("authorization")).toBeTruthy();
      if (method === "GET" && url.searchParams.get("list-type") === "2") {
        const pages = listing[url.searchParams.get("prefix") ?? ""] ?? [[]];
        const page = url.searchParams.get("continuation-token") ? 1 : 0;
        const keys = pages[page] ?? [];
        const more = page + 1 < pages.length;
        return new Response(
          `<ListBucketResult>${keys.map((key) => `<Contents><Key>${key}</Key></Contents>`).join("")}<IsTruncated>${more}</IsTruncated>${more ? "<NextContinuationToken>next</NextContinuationToken>" : ""}</ListBucketResult>`,
        );
      }
      return new Response(null, { status: method === "DELETE" ? 204 : 200 });
    }) as typeof fetch;

    const removed = await purgeSite(
      {
        accountId: "acc",
        accessKeyId: "k",
        secretAccessKey: "s",
        bucket: "brotasites-sites",
        fetch: fakeFetch,
        kv: { accountId: "acc", namespaceId: "ns", apiToken: "t", fetch: fakeFetch },
      },
      { siteId: "s1", subdomain: "padaria" },
    );
    expect(removed).toBe(5);
    const deletes = calls.filter((call) => call.startsWith("DELETE")).sort();
    expect(deletes).toEqual(
      [
        "DELETE kv /client/v4/accounts/acc/storage/kv/namespaces/ns/values/preview:s1",
        "DELETE kv /client/v4/accounts/acc/storage/kv/namespaces/ns/values/site:padaria",
        "DELETE r2 /brotasites-sites/exports/padaria/v1.zip",
        "DELETE r2 /brotasites-sites/previews/s1/tok/index.html",
        "DELETE r2 /brotasites-sites/sites/padaria/v1/a&b.css",
        "DELETE r2 /brotasites-sites/sites/padaria/v1/index.html",
        "DELETE r2 /brotasites-sites/sites/padaria/v2/index.html",
      ].sort(),
    );
  });
});
