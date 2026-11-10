import { describe, expect, it } from "vitest";
import { adminUrl, assertProductionHosts, productionHostProblems, readHosts } from "./hosts";
import { checkDomain, platformHosts } from "./validate";

const production = {
  NEXT_PUBLIC_PLATFORM_URL: "https://brotasites.com.br",
  NEXT_PUBLIC_BASE_DOMAIN: "brotasites.com",
  NEXT_PUBLIC_ADMIN_HOST: "admin.brotasites.com.br",
  NEXT_PUBLIC_PREVIEW_ORIGIN: "https://previa.brotasites.com",
};

describe("hosts", () => {
  it("keeps the development defaults without variables", () => {
    const hosts = readHosts({});
    expect(hosts.platformUrl).toBe("http://localhost:3000");
    expect(hosts.platformHost).toBe("localhost");
    expect(hosts.adminHost).toBeNull();
    expect(hosts.sitesDomain).toBe("sites.localhost");
    expect(hosts.exampleSitesDomain).toBe("brotasites.com");
    expect(hosts.previewOrigin).toBe("http://127.0.0.1:4500");
    expect(hosts.contactEmail).toBeNull();
    expect(hosts.privacyEmail).toBeNull();
    expect(hosts.abuseEmail).toBeNull();
  });

  it("reads the production addresses and derives the emails from the platform's host", () => {
    const hosts = readHosts({
      ...production,
      NEXT_PUBLIC_PLATFORM_URL: "https://brotasites.com.br/",
    });
    expect(hosts.platformUrl).toBe("https://brotasites.com.br");
    expect(hosts.platformHost).toBe("brotasites.com.br");
    expect(hosts.adminHost).toBe("admin.brotasites.com.br");
    expect(hosts.sitesDomain).toBe("brotasites.com");
    expect(hosts.exampleSitesDomain).toBe("brotasites.com");
    expect(hosts.contactEmail).toBe("contato@brotasites.com.br");
    expect(hosts.privacyEmail).toBe("privacidade@brotasites.com.br");
    expect(hosts.abuseEmail).toBe("abuso@brotasites.com.br");
  });

  it("takes explicit emails and tidies hosts", () => {
    const hosts = readHosts({
      ...production,
      NEXT_PUBLIC_ADMIN_HOST: " Admin.BrotaSites.com.br. ",
      NEXT_PUBLIC_BASE_DOMAIN: ".BrotaSites.com",
      NEXT_PUBLIC_CONTACT_EMAIL: "Oi@BrotaSites.com.br",
    });
    expect(hosts.adminHost).toBe("admin.brotasites.com.br");
    expect(hosts.sitesDomain).toBe("brotasites.com");
    expect(hosts.contactEmail).toBe("oi@brotasites.com.br");
  });

  it("links to the team's area on its own host only when there is one", () => {
    expect(adminUrl("/admin/sites", readHosts({}))).toBe("/admin/sites");
    expect(adminUrl("/admin", readHosts(production))).toBe("https://admin.brotasites.com.br/admin");
  });

  it("lists the platform's own hosts, never connectable by a client", () => {
    expect(platformHosts(production)).toEqual([
      "brotasites.com.br",
      "admin.brotasites.com.br",
      "previa.brotasites.com",
    ]);
    const context = { baseDomain: "brotasites.com", platformHosts: platformHosts(production) };
    for (const host of [
      "brotasites.com.br",
      "www.brotasites.com.br",
      "admin.brotasites.com.br",
      "previa.brotasites.com",
      "brotasites.com",
      "www.brotasites.com",
    ]) {
      expect(checkDomain(host, context), host).toMatchObject({ ok: false, problem: "platform" });
    }
  });
});

describe("the production check", () => {
  it("passes with the two domains apart", () => {
    expect(productionHostProblems(production)).toEqual([]);
  });

  it("refuses missing addresses", () => {
    expect(productionHostProblems({})).toEqual([
      "NEXT_PUBLIC_PLATFORM_URL is not set.",
      "NEXT_PUBLIC_BASE_DOMAIN is not set.",
    ]);
  });

  it("refuses the same domain, nested domains and the same registrable domain", () => {
    for (const sites of [
      "brotasites.com.br",
      "sites.brotasites.com.br",
      "outro.brotasites.com.br",
    ]) {
      expect(
        productionHostProblems({ ...production, NEXT_PUBLIC_BASE_DOMAIN: sites }).join(" "),
        sites,
      ).toMatch(/different registrable domains/);
    }
    expect(
      productionHostProblems({
        ...production,
        NEXT_PUBLIC_PLATFORM_URL: "https://app.brotasites.com",
      }).join(" "),
    ).toMatch(/different registrable domains/);
  });

  it("refuses http and an admin host outside the platform's domain", () => {
    expect(
      productionHostProblems({
        ...production,
        NEXT_PUBLIC_PLATFORM_URL: "http://brotasites.com.br",
      }),
    ).toEqual(["NEXT_PUBLIC_PLATFORM_URL must use https://."]);
    expect(
      productionHostProblems({
        ...production,
        NEXT_PUBLIC_ADMIN_HOST: "admin.brotasites.com",
      }).join(" "),
    ).toMatch(/subdomain of the platform's domain/);
  });

  it("throws only in Vercel's production or when asked", () => {
    expect(() => assertProductionHosts({})).not.toThrow();
    expect(() => assertProductionHosts({ VERCEL_ENV: "preview" })).not.toThrow();
    expect(() => assertProductionHosts({ VERCEL_ENV: "production" })).toThrow(
      /refuses to run in production/,
    );
    expect(() => assertProductionHosts({ BROTASITES_STRICT_HOSTS: "1" })).toThrow();
    expect(() => assertProductionHosts({ ...production, VERCEL_ENV: "production" })).not.toThrow();
  });
});
