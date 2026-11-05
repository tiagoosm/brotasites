// Who proves a client's domain and issues its certificate (E25): the hosting, Cloudflare for
// SaaS on the BASE_DOMAIN zone. Like the payment stub and the PreviewHost, an interface with:
// - a simulated provider for development and tests (DOMAINS_MODE=simulated), never in
//   production: no network, deterministic results;
// - the real one, written against Cloudflare's official API (custom hostnames) and NOT run in
//   this step: it needs the owner's account (docs/owner-steps.md, "Client domains").
// Without DOMAINS_MODE the flow is off and the platform says so.
//
// Cloudflare, as checked in its official documentation on 2026-11-05 (cloudflare-docs repository,
// cloudflare-for-platforms/cloudflare-for-saas): POST/GET/PATCH/DELETE
// /zones/{zone_id}/custom_hostnames[/{id}]; a hostname serves traffic once `status` is "active"
// (ownership: the customer's CNAME to our target, or the TXT `ownership_verification` record)
// and `ssl.status` is "active" (the certificate: `ssl.method` "txt" gives
// `ssl.validation_records` with txt_name and txt_value). A no-change PATCH asks Cloudflare to
// validate again sooner.

export type DnsRecord = { type: "CNAME" | "TXT"; name: string; value: string; purpose: string };

export type ProviderState =
  | { state: "pending"; records: DnsRecord[] }
  | { state: "active"; records: DnsRecord[] }
  | { state: "failed"; reason: "refused" | "conflict"; records: DnsRecord[] };

export interface DomainProvider {
  readonly name: "simulated" | "cloudflare";
  /** Registers the hostname with the hosting and returns its id and the records to show. */
  create(host: string): Promise<{ providerId: string } & ProviderState>;
  /** Asks the hosting where the hostname stands (and to try again soon). */
  check(providerId: string, host: string): Promise<ProviderState>;
  /** Drops the hostname from the hosting; a hostname already gone is not an error. */
  remove(providerId: string): Promise<void>;
}

/** The CNAME every client creates: their host to our target (a name on the BASE_DOMAIN zone). */
export function cnameRecord(host: string, target: string): DnsRecord {
  return { type: "CNAME", name: host, value: target, purpose: "route" };
}

// Simulated ---------------------------------------------------------------------------------

/**
 * Deterministic, for development and tests: a host whose first label starts with "pendente"
 * never validates, one starting with "recusado" is refused at once, any other one becomes
 * active on its first check.
 */
export class SimulatedDomainProvider implements DomainProvider {
  readonly name = "simulated" as const;
  constructor(private readonly target: string) {}

  private records(host: string): DnsRecord[] {
    return [
      cnameRecord(host, this.target),
      {
        type: "TXT",
        name: `_cf-custom-hostname.${host}`,
        value: `simulado-${host.replace(/[^a-z0-9]/g, "")}`.slice(0, 60),
        purpose: "ownership",
      },
    ];
  }

  async create(host: string) {
    const providerId = `sim-${host}`;
    if (host.startsWith("recusado")) {
      return { providerId, state: "failed" as const, reason: "refused" as const, records: [] };
    }
    return { providerId, state: "pending" as const, records: this.records(host) };
  }

  async check(_providerId: string, host: string): Promise<ProviderState> {
    if (host.startsWith("recusado")) return { state: "failed", reason: "refused", records: [] };
    if (host.startsWith("pendente")) return { state: "pending", records: this.records(host) };
    return { state: "active", records: this.records(host) };
  }

  async remove(_providerId: string): Promise<void> {}
}

// Cloudflare for SaaS ------------------------------------------------------------------------

interface CloudflareHostname {
  id: string;
  hostname: string;
  status?: string;
  verification_errors?: string[];
  ownership_verification?: { type?: string; name?: string; value?: string };
  ssl?: {
    status?: string;
    validation_records?: { txt_name?: string; txt_value?: string }[];
    validation_errors?: { message?: string }[];
  };
}

export interface CloudflareOptions {
  zoneId: string;
  apiToken: string;
  /** The CNAME target clients point to (for example clientes.<BASE_DOMAIN>). */
  target: string;
  fetch?: typeof fetch;
}

/** Statuses after which the hostname will not become active without a new request. */
const CLOUDFLARE_DEAD = new Set(["blocked", "moved", "deleted"]);

export class CloudflareDomainProvider implements DomainProvider {
  readonly name = "cloudflare" as const;
  constructor(private readonly options: CloudflareOptions) {}

  private async call(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<CloudflareHostname | null> {
    const response = await (this.options.fetch ?? fetch)(
      `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(this.options.zoneId)}/custom_hostnames${path}`,
      {
        method,
        headers: {
          authorization: `Bearer ${this.options.apiToken}`,
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    if (method === "DELETE" && response.status === 404) return null;
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      result?: CloudflareHostname;
      errors?: { code?: number }[];
    } | null;
    if (!response.ok || !payload?.success) {
      // A hostname another zone already holds (code 1406 in Cloudflare's list) is the client's
      // to solve; anything else is ours, and the message never reaches the client as is.
      const codes = (payload?.errors ?? []).map((error) => error.code);
      throw new CloudflareError(response.status, codes);
    }
    return payload.result ?? null;
  }

  private stateOf(result: CloudflareHostname): ProviderState {
    const records: DnsRecord[] = [cnameRecord(result.hostname, this.options.target)];
    const ownership = result.ownership_verification;
    if (ownership?.type === "txt" && ownership.name && ownership.value) {
      records.push({
        type: "TXT",
        name: ownership.name,
        value: ownership.value,
        purpose: "ownership",
      });
    }
    for (const record of result.ssl?.validation_records ?? []) {
      if (record.txt_name && record.txt_value) {
        records.push({
          type: "TXT",
          name: record.txt_name,
          value: record.txt_value,
          purpose: "certificate",
        });
      }
    }
    if (CLOUDFLARE_DEAD.has(result.status ?? ""))
      return { state: "failed", reason: "refused", records };
    if (result.status === "active" && result.ssl?.status === "active")
      return { state: "active", records };
    return { state: "pending", records };
  }

  async create(host: string) {
    try {
      const result = await this.call("POST", "", {
        hostname: host,
        ssl: { method: "txt", type: "dv" },
      });
      if (!result) throw new CloudflareError(500, []);
      return { providerId: result.id, ...this.stateOf(result) };
    } catch (error) {
      if (error instanceof CloudflareError && error.codes.includes(1406)) {
        return {
          providerId: `refused-${host}`,
          state: "failed" as const,
          reason: "conflict" as const,
          records: [],
        };
      }
      throw error;
    }
  }

  async check(providerId: string): Promise<ProviderState> {
    // A no-change PATCH resets Cloudflare's validation backoff; then read the current state.
    await this.call("PATCH", `/${encodeURIComponent(providerId)}`, {}).catch(() => null);
    const result = await this.call("GET", `/${encodeURIComponent(providerId)}`);
    if (!result) return { state: "failed", reason: "refused", records: [] };
    return this.stateOf(result);
  }

  async remove(providerId: string): Promise<void> {
    if (providerId.startsWith("refused-")) return;
    await this.call("DELETE", `/${encodeURIComponent(providerId)}`);
  }
}

export class CloudflareError extends Error {
  constructor(
    readonly status: number,
    readonly codes: (number | undefined)[],
  ) {
    super(`Cloudflare answered ${status}`);
  }
}

/** The provider the environment asks for, or null when the flow is off. */
export function domainProvider(
  env: Record<string, string | undefined> = process.env,
): DomainProvider | null {
  const target = env.CUSTOM_DOMAIN_TARGET || (env.BASE_DOMAIN ? `clientes.${env.BASE_DOMAIN}` : "");
  if (env.DOMAINS_MODE === "simulated")
    return new SimulatedDomainProvider(target || "clientes.sites.localhost");
  if (env.DOMAINS_MODE === "cloudflare") {
    if (!env.CLOUDFLARE_SAAS_ZONE_ID || !env.CLOUDFLARE_SAAS_API_TOKEN || !target) return null;
    return new CloudflareDomainProvider({
      zoneId: env.CLOUDFLARE_SAAS_ZONE_ID,
      apiToken: env.CLOUDFLARE_SAAS_API_TOKEN,
      target,
    });
  }
  return null;
}
