import { createHash, createHmac, randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import type { SiteConfig } from "@brotasites/schema";
import { type KvOptions, kvDelete, publishVersion, putPreviewRecord } from "./kv.js";
import { zipDir } from "./zip.js";

// Uploads a built site to the R2 bucket served by apps/sites-worker, through R2's S3 API.
// Requests are signed with AWS Signature V4 (node:crypto, no SDK). Each deploy goes to a new
// folder, with its .zip export, and the pointer is switched last, so the switch is atomic for
// visitors: in Workers KV when it is configured (kv.ts), else the R2 object `current`.

export interface R2Options {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  fetch?: typeof fetch;
  /** Fixed deploy id (tests). */
  deployId?: string;
  /**
   * The site has no inline style or script (a 1.2 site): its files are marked so the sites
   * Worker serves them under the strict content security policy (apps/sites-worker/src/headers.ts).
   */
  strictCsp?: boolean;
  /** The Worker's pointers and states (E12). Without it, the pointer is R2's `current`. */
  kv?: KvOptions;
}

const CONCURRENCY = 6;

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export function contentTypeFor(path: string): string {
  return contentTypes[extname(path).toLowerCase()] ?? "application/octet-stream";
}

const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) =>
  createHmac("sha256", key).update(data).digest();

/** RFC 3986 encoding of one path segment, as S3 expects. */
const encodeSegment = (segment: string) =>
  encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

export interface SignInput {
  method: string;
  url: URL;
  /** Headers to sign (host is added). Must include x-amz-date and x-amz-content-sha256. */
  headers: Record<string, string>;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** The Authorization header for an S3 request (AWS Signature Version 4). */
export function signS3(input: SignInput): string {
  const headers: Record<string, string> = { host: input.url.host };
  for (const [name, value] of Object.entries(input.headers)) {
    headers[name.toLowerCase()] = value.trim().replace(/\s+/g, " ");
  }
  const names = Object.keys(headers).sort();
  const amzDate = headers["x-amz-date"] ?? "";
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${input.region}/s3/aws4_request`;
  const path = input.url.pathname
    .split("/")
    .map((segment) => encodeSegment(decodeURIComponent(segment)))
    .join("/");
  const query = [...input.url.searchParams]
    .map(([k, v]) => `${encodeSegment(k)}=${encodeSegment(v)}`)
    .sort()
    .join("&");
  const canonical = [
    input.method,
    path,
    query,
    names.map((name) => `${name}:${headers[name]}\n`).join(""),
    names.join(";"),
    headers["x-amz-content-sha256"],
  ].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const key = ["s3", "aws4_request"].reduce(
    (k, part) => hmac(k, part),
    hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region),
  );
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
}

const amzDate = () =>
  new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

const objectUrl = (options: R2Options, key: string) =>
  new URL(
    `https://${options.accountId}.r2.cloudflarestorage.com/${options.bucket}/${key.split("/").map(encodeSegment).join("/")}`,
  );

/** A signed request without a body (GET a listing, DELETE an object). */
async function bodyless(options: R2Options, method: "GET" | "DELETE", url: URL): Promise<Response> {
  const signed = { "x-amz-date": amzDate(), "x-amz-content-sha256": sha256("") };
  const authorization = signS3({
    method,
    url,
    headers: signed,
    region: "auto",
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
  });
  return (options.fetch ?? fetch)(url, { method, headers: { ...signed, authorization } });
}

/** Every key under a prefix (ListObjectsV2, 1,000 at a time). */
export async function listR2Keys(options: R2Options, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const url = new URL(`https://${options.accountId}.r2.cloudflarestorage.com/${options.bucket}`);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    if (token) url.searchParams.set("continuation-token", token);
    const response = await bodyless(options, "GET", url);
    if (!response.ok)
      throw new Error(`Falha ao listar ${prefix} no R2 (resposta ${response.status}).`);
    const xml = await response.text();
    for (const match of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) {
      keys.push(
        (match[1] as string).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
      );
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1]
      : undefined;
  } while (token);
  return keys;
}

export async function deleteR2Object(options: R2Options, key: string): Promise<void> {
  const response = await bodyless(options, "DELETE", objectUrl(options, key));
  if (!response.ok && response.status !== 404) {
    throw new Error(`Falha ao apagar ${key} no R2 (resposta ${response.status}).`);
  }
}

/**
 * Removes everything a deleted site left in hosting (account deletion, E15): its versions,
 * its .zip exports, its previews and its records in KV. Returns how many files went.
 */
export async function purgeSite(
  options: R2Options,
  site: { siteId: string; subdomain: string | null },
): Promise<number> {
  const prefixes = [`previews/${site.siteId}/`];
  if (site.subdomain) prefixes.push(`sites/${site.subdomain}/`, `exports/${site.subdomain}/`);
  let removed = 0;
  for (const prefix of prefixes) {
    const keys = await listR2Keys(options, prefix);
    const queue = [...keys];
    const remove = async () => {
      for (let key = queue.shift(); key; key = queue.shift()) await deleteR2Object(options, key);
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, remove));
    removed += keys.length;
  }
  if (options.kv) {
    if (site.subdomain) await kvDelete(options.kv, `site:${site.subdomain}`);
    await kvDelete(options.kv, `preview:${site.siteId}`);
  }
  return removed;
}

async function putObject(
  options: R2Options,
  key: string,
  body: Uint8Array,
  headers: Record<string, string>,
): Promise<void> {
  const url = objectUrl(options, key);
  const signed: Record<string, string> = {
    ...headers,
    "x-amz-date": amzDate(),
    "x-amz-content-sha256": sha256(body),
  };
  const authorization = signS3({
    method: "PUT",
    url,
    headers: signed,
    region: "auto",
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
  });
  const response = await (options.fetch ?? fetch)(url, {
    method: "PUT",
    headers: { ...signed, authorization },
    body,
  });
  if (!response.ok) {
    throw new Error(`Falha ao enviar ${key} para o R2 (resposta ${response.status}).`);
  }
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Uploads every file of a folder under a key prefix ("sites/x/deploy/"). */
export async function uploadDirToR2(
  outDir: string,
  prefix: string,
  options: R2Options,
  headers: Record<string, string> = {},
): Promise<number> {
  const files = await listFiles(outDir);
  if (!files.some((file) => relative(outDir, file) === "index.html")) {
    throw new Error("O site gerado não tem index.html.");
  }
  const queue = [...files];
  const upload = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const path = relative(outDir, file).split(sep).join("/");
      await putObject(options, `${prefix}${path}`, await readFile(file), {
        "content-type": contentTypeFor(path),
        // R2 keeps x-amz-meta-* headers as the object's custom metadata.
        ...(options.strictCsp ? { "x-amz-meta-csp": "strict" } : {}),
        ...headers,
      });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, upload));
  return files.length;
}

/** Uploads the built site and makes it the live version. Returns the deploy id. */
export async function deployToR2(
  outDir: string,
  config: Pick<SiteConfig, "site"> | { site: { subdomain: string } },
  options: R2Options,
): Promise<string> {
  const subdomain = config.site.subdomain;
  const deployId =
    options.deployId ?? `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  await uploadDirToR2(outDir, `sites/${subdomain}/${deployId}/`, options);
  // The client's copy of this exact version (served by the Worker with a signed link).
  await putObject(options, `exports/${subdomain}/${deployId}.zip`, await zipDir(outDir), {
    "content-type": "application/zip",
  });

  // Only now does the site switch to the new files.
  if (options.kv) {
    await publishVersion(options.kv, subdomain, deployId);
  } else {
    await putObject(options, `sites/${subdomain}/current`, new TextEncoder().encode(deployId), {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    });
  }
  return deployId;
}

/**
 * Uploads a private preview (docs/hosting.md): `previews/<site id>/<token>/`, served by the
 * sites Worker at previa.<domain>/<site id>/<token>/ with noindex. The site must be built with
 * that path as its base.
 */
export async function uploadPreviewToR2(
  outDir: string,
  siteId: string,
  token: string,
  options: R2Options,
): Promise<void> {
  await uploadDirToR2(outDir, `previews/${siteId}/${token}/`, { ...options, strictCsp: true });
  // The Worker opens the preview only with the token recorded here, until it expires.
  if (options.kv) await putPreviewRecord(options.kv, siteId, token);
}
