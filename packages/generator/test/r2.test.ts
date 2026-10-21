import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SiteConfig } from "@brotasites/schema";
import { afterAll, describe, expect, it } from "vitest";
import { contentTypeFor, deployToR2, signS3 } from "../src/r2.js";

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
