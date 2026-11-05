import type { SupabaseClient } from "@supabase/supabase-js";
import type { DomainFailure, DomainStatus } from "@/lib/domains/copy";
import type { DnsRecord, DomainProvider, ProviderState } from "@/lib/domains/provider";
import { checkDomain, platformHosts } from "@/lib/domains/validate";
import { deleteHostingKey, putHostingKey, setCanonicalHost } from "./hosting";

// The client's own domain (E25), on the server: the database decides and records every state
// (supabase/migrations/20261105000000_site_domains.sql), the hosting proves the domain and
// issues the certificate (lib/domains/provider.ts), and Workers KV tells the sites Worker which
// site a host serves. A domain serves the site only once the hosting says it is active.
//
// KV keys (apps/sites-worker):
//   domain:<host>    the subdomain it serves
//   domain:<alias>   {"subdomain", "redirectTo": <host>}: the root of a www pair redirects
//   site:<subdomain> gets "canonicalHost" when the own domain is the main address
// An error with the domain never touches the site at its BrotaSites address (Murphy).

export interface SiteDomain {
  id: string;
  siteId: string;
  host: string;
  aliasHost: string | null;
  status: DomainStatus;
  primary: boolean;
  records: DnsRecord[];
  failure: DomainFailure | null;
  verifyUntil: string;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface Kv {
  put: typeof putHostingKey;
  remove: typeof deleteHostingKey;
  canonical: typeof setCanonicalHost;
}

export const hostingKv: Kv = {
  put: putHostingKey,
  remove: deleteHostingKey,
  canonical: setCanonicalHost,
};

/** A refusal the client reads (pt-BR), with the HTTP status of the route. */
export class DomainRefusal extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const refusals: Record<string, [number, string]> = {
  not_paid: [409, "O domínio próprio fica disponível depois que o site for publicado."],
  domain_exists: [409, "Este site já tem um domínio. Remova o atual para conectar outro."],
  domain_taken: [409, "Esse domínio já está conectado a outro site."],
  site_not_found: [404, "Não encontramos este site na sua conta."],
  domain_not_found: [404, "Este site não tem domínio próprio conectado."],
  bad_transition: [409, "Esse passo não está disponível agora. Atualize a página."],
};

function refusalOf(message: string | undefined): DomainRefusal {
  const code = Object.keys(refusals).find((key) => message?.includes(key));
  const [status, text] = code
    ? (refusals[code] as [number, string])
    : [503, "Não foi possível falar com o serviço agora. Tente de novo em instantes."];
  return new DomainRefusal(status, text);
}

async function rpc<T>(db: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw refusalOf(error.message);
  return data as T;
}

/** The site's domain in use (not removed), when the site is the person's. */
export async function currentDomain(
  db: SupabaseClient,
  siteId: string,
  userId: string,
): Promise<{ domain: SiteDomain | null; subdomain: string | null; paid: boolean }> {
  const { data: site, error } = await db
    .from("sites")
    .select("id, owner_id, subdomain, status, payments(purpose, status)")
    .eq("id", siteId)
    .maybeSingle();
  if (error) throw refusalOf(error.message);
  if (!site || site.owner_id !== userId) throw refusalOf("site_not_found");
  const payments = (site.payments ?? []) as { purpose: string; status: string }[];
  const paid = payments.some(
    (payment) => payment.purpose === "publish" && payment.status === "paid",
  );
  const { data: row } = await db
    .from("site_domains")
    .select("*")
    .eq("site_id", siteId)
    .neq("status", "removed")
    .maybeSingle();
  return { domain: row ? fromRow(row) : null, subdomain: site.subdomain, paid };
}

function fromRow(row: Record<string, unknown>): SiteDomain {
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    host: String(row.host),
    aliasHost: (row.alias_host as string | null) ?? null,
    status: row.status as DomainStatus,
    primary: Boolean(row.is_primary),
    records: (row.dns_records as DnsRecord[]) ?? [],
    failure: (row.failure_reason as DomainFailure | null) ?? null,
    verifyUntil: String(row.verify_until),
    lastCheckedAt: (row.last_checked_at as string | null) ?? null,
    verifiedAt: (row.verified_at as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

/** The domain as the database function returns it (camelCase JSON). */
function fromJson(json: Record<string, unknown>): SiteDomain {
  return {
    id: String(json.id),
    siteId: String(json.siteId),
    host: String(json.host),
    aliasHost: (json.aliasHost as string | null) ?? null,
    status: json.status as DomainStatus,
    primary: Boolean(json.primary),
    records: (json.records as DnsRecord[]) ?? [],
    failure: (json.failure as DomainFailure | null) ?? null,
    verifyUntil: String(json.verifyUntil),
    lastCheckedAt: (json.lastCheckedAt as string | null) ?? null,
    verifiedAt: (json.verifiedAt as string | null) ?? null,
    createdAt: String(json.createdAt),
  };
}

/** The client asks for a domain: checked here, recorded there, registered with the hosting. */
export async function requestDomain(
  db: SupabaseClient,
  provider: DomainProvider,
  input: { siteId: string; userId: string; raw: string; baseDomain: string },
): Promise<SiteDomain> {
  const checked = checkDomain(input.raw, {
    baseDomain: input.baseDomain,
    platformHosts: platformHosts(),
  });
  if (!checked.ok) throw new DomainRefusal(400, checked.message);
  const created = await rpc<Record<string, unknown>>(db, "server_domain_request", {
    p_site_id: input.siteId,
    p_user_id: input.userId,
    p_host: checked.host,
    p_alias: checked.alias,
  });
  const domain = fromJson(created);
  let registered: { providerId: string } & ProviderState;
  try {
    registered = await provider.create(domain.host);
  } catch {
    // The hosting did not answer: nothing stays half made. The client can try again.
    await rpc(db, "server_domain_remove", { p_site_id: input.siteId, p_user_id: null });
    throw refusalOf(undefined);
  }
  let saved = fromJson(
    await rpc<Record<string, unknown>>(db, "server_domain_attach", {
      p_domain_id: domain.id,
      p_provider_id: registered.providerId,
      p_records: registered.records,
    }),
  );
  if (registered.state === "failed") {
    saved = fromJson(
      await rpc<Record<string, unknown>>(db, "server_domain_set_status", {
        p_domain_id: domain.id,
        p_status: "failed",
        p_reason: registered.reason,
      }),
    );
  }
  return saved;
}

/** Points KV at the site for an active domain, or takes it away. */
async function syncKv(
  kv: Kv,
  domain: Pick<SiteDomain, "host" | "aliasHost" | "primary">,
  subdomain: string | null,
  on: boolean,
): Promise<void> {
  if (!subdomain) return;
  if (on) {
    await kv.put(`domain:${domain.host}`, subdomain);
    if (domain.aliasHost) {
      await kv.put(
        `domain:${domain.aliasHost}`,
        JSON.stringify({ subdomain, redirectTo: domain.host }),
      );
    }
    await kv.canonical(subdomain, domain.primary ? domain.host : null);
  } else {
    await kv.remove(`domain:${domain.host}`);
    if (domain.aliasHost) await kv.remove(`domain:${domain.aliasHost}`);
    await kv.canonical(subdomain, null);
  }
}

/** Asks the hosting where the domain stands and records it (the button and the routine). */
export async function checkDomainNow(
  db: SupabaseClient,
  provider: DomainProvider,
  kv: Kv,
  domain: SiteDomain & { providerId?: string | null },
  subdomain: string | null,
  providerId: string,
): Promise<SiteDomain> {
  const result = await provider.check(providerId, domain.host);
  if (result.state === "active") {
    const saved = fromJson(
      await rpc<Record<string, unknown>>(db, "server_domain_set_status", {
        p_domain_id: domain.id,
        p_status: "active",
        p_records: result.records,
      }),
    );
    // KV last: a failure here leaves the domain marked active, and the next check writes again.
    await syncKv(kv, saved, subdomain, true);
    return saved;
  }
  if (result.state === "failed" || domain.status === "active") {
    // An active domain the hosting no longer validates: the DNS changed. Stop serving it there;
    // the BrotaSites address keeps working.
    const saved = fromJson(
      await rpc<Record<string, unknown>>(db, "server_domain_set_status", {
        p_domain_id: domain.id,
        p_status: "failed",
        p_reason: result.state === "failed" ? result.reason : "dns_missing",
        p_records: result.records,
      }),
    );
    if (domain.status === "active") await syncKv(kv, saved, subdomain, false);
    return saved;
  }
  return fromJson(
    await rpc<Record<string, unknown>>(db, "server_domain_set_status", {
      p_domain_id: domain.id,
      p_status: "verifying",
      p_records: result.records,
    }),
  );
}

export async function providerIdOf(db: SupabaseClient, domainId: string): Promise<string | null> {
  const { data } = await db
    .from("site_domains")
    .select("provider_id")
    .eq("id", domainId)
    .maybeSingle();
  return (data?.provider_id as string | null) ?? null;
}

/** The client chooses the main address; the Worker redirects the other one to it. */
export async function setPrimary(
  db: SupabaseClient,
  kv: Kv,
  input: { siteId: string; userId: string; primary: boolean; subdomain: string | null },
): Promise<SiteDomain> {
  const saved = fromJson(
    await rpc<Record<string, unknown>>(db, "server_domain_set_primary", {
      p_site_id: input.siteId,
      p_user_id: input.userId,
      p_primary: input.primary,
    }),
  );
  if (saved.status === "active" && input.subdomain) {
    await kv.canonical(input.subdomain, saved.primary ? saved.host : null);
  }
  return saved;
}

/** Removes the domain: the record first, then KV and the hosting (never left hanging). */
export async function removeDomain(
  db: SupabaseClient,
  provider: DomainProvider | null,
  kv: Kv,
  input: { siteId: string; userId: string | null; subdomain: string | null },
): Promise<void> {
  const removed = await rpc<Record<string, unknown>>(db, "server_domain_remove", {
    p_site_id: input.siteId,
    p_user_id: input.userId,
  });
  const domain = fromJson(removed);
  await syncKv(kv, domain, input.subdomain, false).catch(() => {});
  const providerId = removed.providerId as string | null;
  if (providerId && provider) await provider.remove(providerId).catch(() => {});
}

export interface RoutineResult {
  checked: number;
  activated: number;
  expired: number;
  purged: number;
  failed: number;
}

/**
 * The daily routine (inside the keep-alive cron): domains past their 7 days become "com
 * problema", the ones still waiting are checked, and the domains of sites that went are dropped
 * from KV and the hosting. Idempotent; an error on one domain never stops the others.
 */
export async function runDomainRoutine(
  db: SupabaseClient,
  provider: DomainProvider | null,
  kv: Kv = hostingKv,
  batch = 50,
): Promise<RoutineResult> {
  const result: RoutineResult = { checked: 0, activated: 0, expired: 0, purged: 0, failed: 0 };
  const due = await rpc<{
    expired: number;
    due: {
      id: string;
      host: string;
      aliasHost: string | null;
      providerId: string;
      subdomain: string | null;
      primary: boolean;
    }[];
  }>(db, "server_domains_to_check", { p_limit: batch });
  result.expired = due.expired;
  if (provider) {
    for (const item of due.due) {
      try {
        const { data } = await db.from("site_domains").select("*").eq("id", item.id).maybeSingle();
        if (!data) continue;
        const saved = await checkDomainNow(
          db,
          provider,
          kv,
          fromRow(data),
          item.subdomain,
          item.providerId,
        );
        result.checked += 1;
        if (saved.status === "active") result.activated += 1;
      } catch {
        result.failed += 1;
      }
    }
  }
  const purges = await rpc<
    { id: number; host: string; aliasHost: string | null; providerId: string | null }[]
  >(db, "server_claim_domain_purges", { p_limit: batch });
  for (const purge of purges) {
    try {
      await kv.remove(`domain:${purge.host}`);
      if (purge.aliasHost) await kv.remove(`domain:${purge.aliasHost}`);
      if (purge.providerId && provider) await provider.remove(purge.providerId);
      await rpc(db, "server_finish_domain_purge", { p_id: purge.id, p_error: null });
      result.purged += 1;
    } catch (error) {
      await rpc(db, "server_finish_domain_purge", {
        p_id: purge.id,
        p_error: error instanceof Error ? error.message : "falha",
      }).catch(() => {});
      result.failed += 1;
    }
  }
  return result;
}
