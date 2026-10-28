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
