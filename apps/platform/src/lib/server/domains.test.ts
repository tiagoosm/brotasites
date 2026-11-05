import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SimulatedDomainProvider } from "@/lib/domains/provider";
import { checkDomainNow, type Kv, removeDomain, requestDomain, runDomainRoutine } from "./domains";

// The client's own domain on the server (E25), with a stand-in for the database's functions and
// for Workers KV: a domain serves the site only once the hosting says it is active, the KV keys
// follow the state, and removing takes everything away.

function fakeDb() {
  const rows = new Map<string, Record<string, unknown>>();
  const calls: string[] = [];
  const json = (row: Record<string, unknown>) => ({
    id: row.id,
    siteId: row.site_id,
    host: row.host,
    aliasHost: row.alias_host,
    status: row.status,
    primary: row.is_primary,
    records: row.dns_records,
    failure: row.failure_reason,
    verifyUntil: "2026-11-12T00:00:00Z",
    lastCheckedAt: null,
    verifiedAt: row.status === "active" ? "2026-11-05T00:00:00Z" : null,
    createdAt: "2026-11-05T00:00:00Z",
  });
  const rpc = async (name: string, args: Record<string, unknown>) => {
    calls.push(name);
    if (name === "server_domain_request") {
      const row = {
        id: "d1",
        site_id: args.p_site_id,
        host: args.p_host,
        alias_host: args.p_alias,
        status: "pending",
        is_primary: true,
        dns_records: [],
        failure_reason: null,
        provider_id: null,
      };
      rows.set("d1", row);
      return { data: json(row), error: null };
    }
    const row = rows.get("d1") as Record<string, unknown>;
    if (name === "server_domain_attach") {
      Object.assign(row, { provider_id: args.p_provider_id, dns_records: args.p_records });
      return { data: json(row), error: null };
    }
    if (name === "server_domain_set_status") {
      Object.assign(row, { status: args.p_status, failure_reason: args.p_reason ?? null });
      return { data: json(row), error: null };
    }
    if (name === "server_domain_remove") {
      Object.assign(row, { status: "removed" });
      return { data: { ...json(row), providerId: row.provider_id }, error: null };
    }
    if (name === "server_domains_to_check") {
      return {
        data: {
          expired: 0,
          due: [
            {
              id: "d1",
              host: row.host,
              aliasHost: row.alias_host,
              providerId: row.provider_id,
              subdomain: "padaria-do-ze",
              primary: true,
            },
          ],
        },
        error: null,
      };
    }
    if (name === "server_claim_domain_purges") return { data: [], error: null };
    return { data: null, error: { message: "unknown" } };
  };
  const from = () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: rows.get("d1") ?? null }) }),
    }),
  });
  return { db: { rpc, from } as unknown as SupabaseClient, rows, calls };
}

function fakeKv() {
  const store = new Map<string, string>();
  const canonical = new Map<string, string | null>();
  const kv: Kv = {
    put: async (key, value) => {
      store.set(key, value);
      return "saved";
    },
    remove: async (key) => {
      store.delete(key);
      return "deleted";
    },
    canonical: async (subdomain, host) => {
      canonical.set(subdomain, host);
      return "synced";
    },
  };
  return { kv, store, canonical };
}

const input = {
  siteId: "s1",
  userId: "u1",
  raw: "padariadoze.com.br",
  baseDomain: "brotasites.com.br",
};

describe("connecting a domain", () => {
  it("records it, registers it with the hosting and shows the records, serving nothing yet", async () => {
    const { db } = fakeDb();
    const { kv, store } = fakeKv();
    const domain = await requestDomain(db, new SimulatedDomainProvider("clientes.b.com"), input);
    expect(domain).toMatchObject({
      host: "www.padariadoze.com.br",
      aliasHost: "padariadoze.com.br",
      status: "pending",
    });
    expect(domain.records.map((record) => record.type)).toEqual(["CNAME", "TXT"]);
    expect(store.size).toBe(0);
    void kv;
  });

  it("refuses a bad domain before the database or the hosting hear of it", async () => {
    const { db, calls } = fakeDb();
    await expect(
      requestDomain(db, new SimulatedDomainProvider("c"), { ...input, raw: "brotasites.com.br" }),
    ).rejects.toThrow("Esse domínio é da BrotaSites.");
    expect(calls).toEqual([]);
  });

  it("serves the site once the hosting validates it, the root redirecting to the www", async () => {
    const { db } = fakeDb();
    const { kv, store, canonical } = fakeKv();
    const provider = new SimulatedDomainProvider("clientes.b.com");
    const domain = await requestDomain(db, provider, input);
    const active = await checkDomainNow(db, provider, kv, domain, "padaria-do-ze", "sim-x");
    expect(active.status).toBe("active");
    expect(store.get("domain:www.padariadoze.com.br")).toBe("padaria-do-ze");
    expect(JSON.parse(store.get("domain:padariadoze.com.br") ?? "")).toEqual({
      subdomain: "padaria-do-ze",
      redirectTo: "www.padariadoze.com.br",
    });
    expect(canonical.get("padaria-do-ze")).toBe("www.padariadoze.com.br");
  });

  it("keeps waiting while the hosting cannot validate, and the routine checks it", async () => {
    const { db, calls } = fakeDb();
    const { kv, store } = fakeKv();
    const provider = new SimulatedDomainProvider("c");
    await requestDomain(db, provider, { ...input, raw: "pendente.padariadoze.com.br" });
    const result = await runDomainRoutine(db, provider, kv);
    expect(result).toMatchObject({ checked: 1, activated: 0, failed: 0 });
    expect(calls).toContain("server_domain_set_status");
    expect(store.size).toBe(0);
  });

  it("stops serving an active domain the hosting no longer validates", async () => {
    const { db, rows } = fakeDb();
    const { kv, store } = fakeKv();
    const provider = new SimulatedDomainProvider("c");
    const domain = await requestDomain(db, provider, input);
    await checkDomainNow(db, provider, kv, domain, "padaria-do-ze", "sim");
    // The DNS changed: now the hosting refuses it.
    const refusing = {
      ...provider,
      name: "simulated" as const,
      create: provider.create.bind(provider),
      remove: provider.remove.bind(provider),
      check: async () => ({ state: "failed" as const, reason: "refused" as const, records: [] }),
    };
    const failed = await checkDomainNow(
      db,
      refusing,
      kv,
      { ...domain, status: "active" },
      "padaria-do-ze",
      "sim",
    );
    expect(failed.status).toBe("failed");
    expect(rows.get("d1")?.failure_reason).toBe("refused");
    expect(store.size).toBe(0);
  });

  it("removing takes the domain out of KV, the main address back, and the hosting's record", async () => {
    const { db } = fakeDb();
    const { kv, store, canonical } = fakeKv();
    const removed: string[] = [];
    const provider = new SimulatedDomainProvider("c");
    provider.remove = async (id: string) => {
      removed.push(id);
    };
    const domain = await requestDomain(db, provider, input);
    await checkDomainNow(db, provider, kv, domain, "padaria-do-ze", "sim");
    await removeDomain(db, provider, kv, {
      siteId: "s1",
      userId: "u1",
      subdomain: "padaria-do-ze",
    });
    expect(store.size).toBe(0);
    expect(canonical.get("padaria-do-ze")).toBeNull();
    expect(removed).toEqual(["sim-www.padariadoze.com.br"]);
  });
});
