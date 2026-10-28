// The sites Worker's pointers and states in Workers KV (docs/hosting.md), written through the
// Cloudflare API with a token that may only edit that namespace. Keys:
//   site:<subdomain>   {"version", "previous", "state", "updatedAt"}: the live version and the
//                      site's state (active, grace, suspended, offline)
//   domain:<host>      the subdomain a client's custom domain serves
//   preview:<site id>  {"token", "expiresAt"}: the only token that opens the private preview
// KV is eventually consistent: a change can take up to 60 s where the key was read recently.

export interface KvOptions {
  accountId: string;
  namespaceId: string;
  apiToken: string;
  fetch?: typeof fetch;
}

export type SiteState = "active" | "grace" | "suspended" | "offline";

export interface SiteRecord {
  version: string;
  previous?: string;
  state: SiteState;
  updatedAt: string;
}

const states: readonly SiteState[] = ["active", "grace", "suspended", "offline"];
/** Previews stop opening after this, unless a new build renews them. */
export const PREVIEW_DAYS = 30;

function valueUrl(options: KvOptions, key: string, query = ""): string {
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.accountId)}/storage/kv/namespaces/${encodeURIComponent(options.namespaceId)}/values/${encodeURIComponent(key)}${query}`;
}

export async function kvGet(options: KvOptions, key: string): Promise<string | null> {
  const response = await (options.fetch ?? fetch)(valueUrl(options, key), {
    headers: { authorization: `Bearer ${options.apiToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Falha ao ler ${key} no KV (resposta ${response.status}).`);
  return response.text();
}

export async function kvPut(
  options: KvOptions,
  key: string,
  value: string,
  expirationTtl?: number,
): Promise<void> {
  const query = expirationTtl ? `?expiration_ttl=${Math.max(60, Math.round(expirationTtl))}` : "";
  const response = await (options.fetch ?? fetch)(valueUrl(options, key, query), {
    method: "PUT",
    headers: { authorization: `Bearer ${options.apiToken}`, "content-type": "text/plain" },
    body: value,
  });
  if (!response.ok) throw new Error(`Falha ao gravar ${key} no KV (resposta ${response.status}).`);
}

export function parseSiteRecord(raw: string | null): SiteRecord | null {
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as Partial<SiteRecord>;
    if (typeof record.version !== "string" || !states.includes(record.state as SiteState)) {
      return null;
    }
    return record as SiteRecord;
  } catch {
    return null;
  }
}

export async function readSiteRecord(options: KvOptions, subdomain: string) {
  return parseSiteRecord(await kvGet(options, `site:${subdomain}`));
}

async function writeSiteRecord(options: KvOptions, subdomain: string, record: SiteRecord) {
  await kvPut(options, `site:${subdomain}`, JSON.stringify(record));
}

/**
 * Makes a version live, keeping the one before for a rollback. A suspended or offline site
 * stays that way: publishing never lifts a suspension.
 */
export async function publishVersion(
  options: KvOptions,
  subdomain: string,
  version: string,
): Promise<SiteRecord> {
  const current = await readSiteRecord(options, subdomain);
  const record: SiteRecord = {
    version,
    previous: current && current.version !== version ? current.version : current?.previous,
    state:
      current?.state === "suspended" || current?.state === "offline" ? current.state : "active",
    updatedAt: new Date().toISOString(),
  };
  await writeSiteRecord(options, subdomain, record);
  return record;
}

/** Puts the previous version back live (a quick rollback). */
export async function rollbackSite(options: KvOptions, subdomain: string): Promise<SiteRecord> {
  const current = await readSiteRecord(options, subdomain);
  if (!current?.previous) throw new Error(`O site ${subdomain} não tem versão anterior.`);
  const record: SiteRecord = {
    ...current,
    version: current.previous,
    previous: current.version,
    updatedAt: new Date().toISOString(),
  };
  await writeSiteRecord(options, subdomain, record);
  return record;
}

export async function setSiteState(
  options: KvOptions,
  subdomain: string,
  state: SiteState,
): Promise<SiteRecord | null> {
  const current = await readSiteRecord(options, subdomain);
  if (!current) return null;
  const record = { ...current, state, updatedAt: new Date().toISOString() };
  await writeSiteRecord(options, subdomain, record);
  return record;
}

/** The token that opens a site's private preview, for PREVIEW_DAYS days (KV removes it after). */
export async function putPreviewRecord(
  options: KvOptions,
  siteId: string,
  token: string,
  now = Date.now(),
): Promise<void> {
  const seconds = PREVIEW_DAYS * 24 * 3600;
  await kvPut(
    options,
    `preview:${siteId}`,
    JSON.stringify({ token, expiresAt: new Date(now + seconds * 1000).toISOString() }),
    seconds,
  );
}
