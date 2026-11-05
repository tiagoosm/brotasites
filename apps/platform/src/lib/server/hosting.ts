import { createHmac } from "node:crypto";

// The platform's side of the sites Worker (docs/hosting.md): signed links to the .zip export
// and the site's state in Workers KV when an admin suspends or restores it. Both are off until
// the owner sets the Cloudflare variables (docs/owner-steps.md); the server only.

const EXPORT_SECONDS = 600;

export type SiteState = "active" | "grace" | "suspended" | "offline";

/** A link to the .zip of the site's live version, valid for 10 minutes, or null when off. */
export function exportLink(subdomain: string, now = Date.now()): string | null {
  const secret = process.env.EXPORT_SECRET;
  const origin = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN?.replace(/\/$/, "");
  if (!secret || !origin) return null;
  const expires = Math.floor(now / 1000) + EXPORT_SECONDS;
  // The same signature the Worker checks (apps/sites-worker/src/index.ts, exportSignature).
  const signature = createHmac("sha256", secret).update(`${subdomain}.${expires}`).digest("hex");
  return `${origin}/_export/${subdomain}?exp=${expires}&sig=${signature}`;
}

function kvUrl(key: string): string | null {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespace = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
  if (!account || !namespace || !process.env.CLOUDFLARE_KV_API_TOKEN) return null;
  return `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}/values/${encodeURIComponent(key)}`;
}

/**
 * Sets a published site's state in KV (packages/generator/src/kv.ts has the same record).
 * "not-published" when the site never went live; "off" without the Cloudflare variables.
 */
export async function setHostingState(
  subdomain: string,
  state: SiteState,
  fetcher: typeof fetch = fetch,
): Promise<"synced" | "not-published" | "off"> {
  const url = kvUrl(`site:${subdomain}`);
  if (!url) return "off";
  const headers = { authorization: `Bearer ${process.env.CLOUDFLARE_KV_API_TOKEN}` };
  const current = await fetcher(url, { headers, cache: "no-store" });
  if (current.status === 404) return "not-published";
  if (!current.ok) throw new Error(`KV read failed (${current.status})`);
  const record = JSON.parse(await current.text()) as Record<string, unknown>;
  const saved = await fetcher(url, {
    method: "PUT",
    headers: { ...headers, "content-type": "text/plain" },
    body: JSON.stringify({ ...record, state, updatedAt: new Date().toISOString() }),
  });
  if (!saved.ok) throw new Error(`KV write failed (${saved.status})`);
  return "synced";
}

/** Removes a key from KV (a deleted site's preview record); "off" without the variables. */
export async function deleteHostingKey(
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<"deleted" | "off"> {
  const url = kvUrl(key);
  if (!url) return "off";
  const response = await fetcher(url, {
    method: "DELETE",
    headers: { authorization: `Bearer ${process.env.CLOUDFLARE_KV_API_TOKEN}` },
  });
  if (!response.ok && response.status !== 404)
    throw new Error(`KV delete failed (${response.status})`);
  return "deleted";
}

/** Writes a key in KV (a client domain's pointer); "off" without the Cloudflare variables. */
export async function putHostingKey(
  key: string,
  value: string,
  fetcher: typeof fetch = fetch,
): Promise<"saved" | "off"> {
  const url = kvUrl(key);
  if (!url) return "off";
  const response = await fetcher(url, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${process.env.CLOUDFLARE_KV_API_TOKEN}`,
      "content-type": "text/plain",
    },
    body: value,
  });
  if (!response.ok) throw new Error(`KV write failed (${response.status})`);
  return "saved";
}

/**
 * The site's main address (E25): its own domain, or null for the BrotaSites address. The Worker
 * redirects the other one to it (apps/sites-worker, canonicalHost). Kept in the site's record,
 * which publishing preserves (packages/generator/src/kv.ts).
 */
export async function setCanonicalHost(
  subdomain: string,
  host: string | null,
  fetcher: typeof fetch = fetch,
): Promise<"synced" | "not-published" | "off"> {
  const url = kvUrl(`site:${subdomain}`);
  if (!url) return "off";
  const headers = { authorization: `Bearer ${process.env.CLOUDFLARE_KV_API_TOKEN}` };
  const current = await fetcher(url, { headers, cache: "no-store" });
  if (current.status === 404) return "not-published";
  if (!current.ok) throw new Error(`KV read failed (${current.status})`);
  const { canonicalHost: _old, ...record } = JSON.parse(await current.text()) as Record<
    string,
    unknown
  >;
  const saved = await fetcher(url, {
    method: "PUT",
    headers: { ...headers, "content-type": "text/plain" },
    body: JSON.stringify({
      ...record,
      ...(host ? { canonicalHost: host } : {}),
      updatedAt: new Date().toISOString(),
    }),
  });
  if (!saved.ok) throw new Error(`KV write failed (${saved.status})`);
  return "synced";
}
