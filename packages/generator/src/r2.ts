import { createHash, createHmac, randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import type { SiteConfig } from "@brotasites/schema";

// Uploads a built site to the R2 bucket served by apps/sites-worker, through R2's S3 API.
// Requests are signed with AWS Signature V4 (node:crypto, no SDK). Each deploy goes to a new
// folder and the `current` pointer is written last, so the switch is atomic for visitors.

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

async function putObject(
  options: R2Options,
  key: string,
  body: Uint8Array,
  headers: Record<string, string>,
): Promise<void> {
  const url = new URL(
    `https://${options.accountId}.r2.cloudflarestorage.com/${options.bucket}/${key.split("/").map(encodeSegment).join("/")}`,
  );
  const signed: Record<string, string> = {
    ...headers,
    "x-amz-date": new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, ""),
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

/** Uploads the built site and makes it the live version. Returns the deploy id. */
export async function deployToR2(
  outDir: string,
  config: SiteConfig,
  options: R2Options,
): Promise<string> {
  const subdomain = config.site.subdomain;
  const deployId =
    options.deployId ?? `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const files = await listFiles(outDir);
  if (!files.some((file) => relative(outDir, file) === "index.html")) {
    throw new Error("O site gerado não tem index.html.");
  }

  const queue = [...files];
  const upload = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const path = relative(outDir, file).split(sep).join("/");
      await putObject(options, `sites/${subdomain}/${deployId}/${path}`, await readFile(file), {
        "content-type": contentTypeFor(path),
        // R2 keeps x-amz-meta-* headers as the object's custom metadata.
        ...(options.strictCsp ? { "x-amz-meta-csp": "strict" } : {}),
      });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, upload));

  // Only now does the site switch to the new files.
  await putObject(options, `sites/${subdomain}/current`, new TextEncoder().encode(deployId), {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  return deployId;
}
