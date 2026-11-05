import { describe, expect, it } from "vitest";
import { domainFailure, domainStatus } from "./copy";
import { CloudflareDomainProvider, domainProvider, SimulatedDomainProvider } from "./provider";
import { checkDomain, publicSuffix, registrableDomain } from "./validate";

// The client's own domain (E25): the checks before anything reaches the hosting, the
// simulated and the Cloudflare providers (with a stand-in for its API: never the real one),
// and the client's texts.

const context = {
  baseDomain: "brotasites.com.br",
  platformHosts: ["brotasites.vercel.app", "previa.brotasites.com.br"],
};
const check = (raw: string) => checkDomain(raw, context);
const problem = (raw: string) => {
  const result = check(raw);
  return result.ok ? null : result.problem;
};

describe("public suffixes", () => {
  it("finds the registrable domain by the Public Suffix List", () => {
    expect(publicSuffix("www.padariadoze.com.br")).toBe("com.br");
    expect(registrableDomain("www.padariadoze.com.br")).toBe("padariadoze.com.br");
    expect(registrableDomain("loja.minhaempresa.co.uk")).toBe("minhaempresa.co.uk");
    expect(registrableDomain("padariadoze.com")).toBe("padariadoze.com");
    expect(registrableDomain("com.br")).toBeNull();
  });
});

describe("a valid domain", () => {
  it("connects the www and keeps the root as its pair", () => {
    for (const raw of [
      "padariadoze.com.br",
      "www.padariadoze.com.br",
      "  WWW.PadariaDoZe.com.br  ",
      "https://padariadoze.com.br/",
      "padariadoze.com.br.",
    ]) {
      expect(check(raw), raw).toEqual({
        ok: true,
        host: "www.padariadoze.com.br",
        alias: "padariadoze.com.br",
        registrable: "padariadoze.com.br",
      });
    }
  });

  it("connects another subdomain as typed, without a pair", () => {
    expect(check("loja.padariadoze.com.br")).toEqual({
      ok: true,
      host: "loja.padariadoze.com.br",
      alias: null,
      registrable: "padariadoze.com.br",
    });
    expect(check("studio-lume.art.br")).toMatchObject({ ok: true, host: "www.studio-lume.art.br" });
  });
});

describe("refused domains", () => {
  it.each([
    ["", "empty"],
    ["http://padariadoze.com.br/cardapio", "format"],
    ["padariadoze.com.br:8080", "format"],
    ["padaria doze.com.br", "format"],
    ["user@padariadoze.com.br", "format"],
    ["-padaria.com.br", "format"],
    ["padaria_doze.com.br", "format"],
    ["padariadozé.com.br", "not_ascii"],
    ["xn--padariadoz-k7a.com.br", "punycode"],
    ["pаdaria.com.br", "not_ascii"], // Cyrillic "а": a look-alike
    ["*.padariadoze.com.br", "wildcard"],
    ["192.168.0.1", "ip"],
    ["[::1]", "ip"],
    [`${"a".repeat(64)}.com.br`, "too_long"],
    [`${"abc.".repeat(64)}com.br`, "too_long"],
    ["localhost", "no_suffix"],
    ["padaria.localhost", "reserved"],
    ["padaria.test", "reserved"],
    ["padaria.local", "reserved"],
    ["example.com", "reserved"],
    ["www.example.org", "reserved"],
    ["com.br", "no_suffix"],
    ["padaria.naoexiste", "no_suffix"],
    ["brotasites.com.br", "platform"],
    ["padaria-do-ze.brotasites.com.br", "platform"],
    ["brotasites.vercel.app", "platform"],
    ["meusite.vercel.app", "platform"],
    ["algo.workers.dev", "platform"],
    ["brotasites.com", "platform"],
    ["receita.gov.br", "protected"],
    ["tribunal.jus.br", "protected"],
    ["meubanco.b.br", "protected"],
    ["banco-do-povo.com.br", "protected"],
    ["bradescopromo.com.br", "protected"],
    ["meunubank.com", "protected"],
    ["pix-facil.com.br", "protected"],
    ["loja.santander-ofertas.com", "protected"],
  ])("%s → %s", (raw, expected) => {
    expect(problem(raw)).toBe(expected);
  });

  it("says how to fix it, in Portuguese, without internal details", () => {
    const result = check("http://padariadoze.com.br/x");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(
        "Escreva só o domínio, como seunegocio.com.br, sem http://, barras, porta ou espaços.",
      );
    }
  });

  it("does not refuse ordinary words that only contain a short brand", () => {
    // "pix" and "gov" are refused as whole words, not inside "pixel" or "governanca".
    expect(problem("pixelstudio.com.br")).toBeNull();
    expect(problem("governancapro.com.br")).toBeNull();
  });
});

describe("simulated provider", () => {
  const provider = new SimulatedDomainProvider("clientes.brotasites.com.br");

  it("shows the CNAME and the ownership TXT, then validates on the first check", async () => {
    const created = await provider.create("www.padariadoze.com.br");
    expect(created.state).toBe("pending");
    expect(created.records[0]).toEqual({
      type: "CNAME",
      name: "www.padariadoze.com.br",
      value: "clientes.brotasites.com.br",
      purpose: "route",
    });
    expect(created.records[1]).toMatchObject({ type: "TXT", purpose: "ownership" });
    expect((await provider.check(created.providerId, "www.padariadoze.com.br")).state).toBe(
      "active",
    );
  });

  it("keeps a 'pendente' host waiting and refuses a 'recusado' host", async () => {
    expect((await provider.check("x", "pendente.padariadoze.com.br")).state).toBe("pending");
    expect(await provider.check("x", "recusado.padariadoze.com.br")).toMatchObject({
      state: "failed",
      reason: "refused",
    });
  });
});

describe("Cloudflare provider (against a stand-in of its API)", () => {
  function api(responses: Record<string, unknown>) {
    const calls: { method: string; url: string; body: unknown; auth: string }[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      calls.push({
        method,
        url,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        auth: (init?.headers as Record<string, string>).authorization ?? "",
      });
      const answer = responses[`${method} ${url.replace(/^.*custom_hostnames/, "")}`];
      if (answer === undefined) return new Response("{}", { status: 404 });
      const [status, payload] = answer as [number, unknown];
      return new Response(JSON.stringify(payload), { status });
    };
    return { calls, fetcher };
  }
  const hostname = {
    id: "ch-1",
    hostname: "www.padariadoze.com.br",
    status: "pending",
    ownership_verification: {
      type: "txt",
      name: "_cf-custom-hostname.www.padariadoze.com.br",
      value: "abc",
    },
    ssl: {
      status: "pending_validation",
      validation_records: [
        { txt_name: "_acme-challenge.www.padariadoze.com.br", txt_value: "def" },
      ],
    },
  };

  it("creates the hostname with TXT validation and returns the 3 records to show", async () => {
    const { calls, fetcher } = api({ "POST ": [201, { success: true, result: hostname }] });
    const provider = new CloudflareDomainProvider({
      zoneId: "zona",
      apiToken: "token",
      target: "clientes.brotasites.com.br",
      fetch: fetcher,
    });
    const created = await provider.create("www.padariadoze.com.br");
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "https://api.cloudflare.com/client/v4/zones/zona/custom_hostnames",
      body: { hostname: "www.padariadoze.com.br", ssl: { method: "txt", type: "dv" } },
      auth: "Bearer token",
    });
    expect(created).toMatchObject({ providerId: "ch-1", state: "pending" });
    expect(created.records.map((record) => record.purpose)).toEqual([
      "route",
      "ownership",
      "certificate",
    ]);
  });

  it("is active only when the hostname and its certificate are both active", async () => {
    const pending = api({
      "PATCH /ch-1": [202, { success: true, result: hostname }],
      "GET /ch-1": [200, { success: true, result: { ...hostname, status: "active" } }],
    });
    const provider = (fetcher: typeof fetch) =>
      new CloudflareDomainProvider({ zoneId: "zona", apiToken: "t", target: "c", fetch: fetcher });
    expect((await provider(pending.fetcher).check("ch-1")).state).toBe("pending");
    const active = api({
      "PATCH /ch-1": [202, { success: true, result: hostname }],
      "GET /ch-1": [
        200,
        { success: true, result: { ...hostname, status: "active", ssl: { status: "active" } } },
      ],
    });
    expect((await provider(active.fetcher).check("ch-1")).state).toBe("active");
    // The no-change PATCH comes first, to make Cloudflare validate again sooner.
    expect(active.calls.map((call) => call.method)).toEqual(["PATCH", "GET"]);
  });

  it("turns a hostname another zone holds into the client's 'conflict', and other errors into ours", async () => {
    const duplicate = api({ "POST ": [409, { success: false, errors: [{ code: 1406 }] }] });
    const provider = new CloudflareDomainProvider({
      zoneId: "z",
      apiToken: "t",
      target: "c",
      fetch: duplicate.fetcher,
    });
    expect(await provider.create("www.padariadoze.com.br")).toMatchObject({
      state: "failed",
      reason: "conflict",
    });
    const quota = api({ "POST ": [403, { success: false, errors: [{ code: 1405 }] }] });
    await expect(
      new CloudflareDomainProvider({
        zoneId: "z",
        apiToken: "t",
        target: "c",
        fetch: quota.fetcher,
      }).create("www.padariadoze.com.br"),
    ).rejects.toThrow("Cloudflare answered 403");
  });

  it("removing a hostname that is already gone is not an error", async () => {
    const gone = api({});
    const provider = new CloudflareDomainProvider({
      zoneId: "z",
      apiToken: "t",
      target: "c",
      fetch: gone.fetcher,
    });
    await expect(provider.remove("ch-1")).resolves.toBeUndefined();
  });
});

describe("which provider", () => {
  it("is off without DOMAINS_MODE, and the real one needs its variables", () => {
    expect(domainProvider({})).toBeNull();
    expect(domainProvider({ DOMAINS_MODE: "simulated" })?.name).toBe("simulated");
    expect(domainProvider({ DOMAINS_MODE: "cloudflare", BASE_DOMAIN: "b.com" })).toBeNull();
    expect(
      domainProvider({
        DOMAINS_MODE: "cloudflare",
        BASE_DOMAIN: "b.com",
        CLOUDFLARE_SAAS_ZONE_ID: "z",
        CLOUDFLARE_SAAS_API_TOKEN: "t",
      })?.name,
    ).toBe("cloudflare");
  });
});

describe("the client's texts", () => {
  it("names every state and every failure in plain Portuguese", () => {
    expect(domainStatus.pending.label).toBe("Aguardando configuração");
    expect(domainStatus.verifying.label).toBe("Verificando");
    expect(domainStatus.active.label).toBe("Ativo");
    expect(domainStatus.failed.label).toBe("Com problema");
    expect(domainStatus.removed.label).toBe("Removido");
    for (const text of Object.values(domainFailure)) {
      expect(text).not.toMatch(/cloudflare|cname|txt|api|erro \d/i);
      expect(text).toMatch(/tente de novo/);
    }
  });
});
