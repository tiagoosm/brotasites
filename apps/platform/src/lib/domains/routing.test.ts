import { describe, expect, it } from "vitest";
import { readHosts } from "./hosts";
import { normalizeHost, routeByHost } from "./routing";

const production = readHosts({
  NEXT_PUBLIC_PLATFORM_URL: "https://brotasites.com.br",
  NEXT_PUBLIC_BASE_DOMAIN: "brotasites.com",
  NEXT_PUBLIC_ADMIN_HOST: "admin.brotasites.com.br",
});
const withoutAdmin = readHosts({
  NEXT_PUBLIC_PLATFORM_URL: "https://brotasites.com.br",
  NEXT_PUBLIC_BASE_DOMAIN: "brotasites.com",
});
const route = (host: string | null, path: string, search = "", hosts = production, live = true) =>
  routeByHost({ host, path, search }, hosts, live);

describe("host routing", () => {
  it("normalizes the host: case, port, trailing dot, lists", () => {
    expect(normalizeHost("Admin.BrotaSites.com.br:443")).toBe("admin.brotasites.com.br");
    expect(normalizeHost("brotasites.com.br.")).toBe("brotasites.com.br");
    expect(normalizeHost("a.com, b.com")).toBe("a.com");
    expect(normalizeHost("[::1]:3000")).toBe("[::1]");
    expect(normalizeHost(null)).toBe("");
  });

  it("changes nothing without an admin host (development, tests)", () => {
    for (const path of ["/", "/admin", "/admin/sites/1", "/api/admin/queue", "/entrar"]) {
      expect(route("localhost:3000", path, "", readHosts({}), false)).toEqual({
        kind: "pass",
        admin: false,
      });
      expect(route("brotasites.com.br", path, "", withoutAdmin)).toEqual({
        kind: "pass",
        admin: false,
      });
    }
  });

  it("moves the team's area off the platform's address, permanently, keeping path and query", () => {
    expect(route("brotasites.com.br", "/admin")).toEqual({
      kind: "redirect",
      location: "https://admin.brotasites.com.br/admin",
      status: 308,
    });
    expect(route("BrotaSites.com.br:443", "/admin/sites/abc", "?aba=2")).toEqual({
      kind: "redirect",
      location: "https://admin.brotasites.com.br/admin/sites/abc?aba=2",
      status: 308,
    });
    // Not a prefix match: "/administrador" is not the team's area.
    expect(route("brotasites.com.br", "/administrador")).toEqual({ kind: "pass", admin: false });
    // The team's API answers only on the team's host.
    expect(route("brotasites.com.br", "/api/admin/queue")).toEqual({ kind: "not-found" });
  });

  it("serves only the team's area and signing in on the admin host", () => {
    for (const path of [
      "/admin",
      "/admin/catalogo",
      "/api/admin/sites/1/decide",
      "/api/auth/sign-in",
      "/api/account/me",
      "/auth/sair",
      "/auth/confirm",
      "/robots.txt",
    ]) {
      expect(route("admin.brotasites.com.br", path), path).toEqual({ kind: "pass", admin: true });
    }
    expect(route("admin.brotasites.com.br", "/entrar", "?voltar=%2Fadmin%2Fcontas")).toEqual({
      kind: "pass",
      admin: true,
    });
  });

  it("sends the admin host's root and a bare sign-in to the team's area", () => {
    expect(route("admin.brotasites.com.br", "/")).toEqual({
      kind: "redirect",
      location: "https://admin.brotasites.com.br/admin",
      status: 307,
    });
    expect(route("admin.brotasites.com.br", "/entrar")).toEqual({
      kind: "redirect",
      location: "https://admin.brotasites.com.br/entrar?voltar=%2Fadmin",
      status: 307,
    });
  });

  it("sends everything else on the admin host back to the platform", () => {
    for (const [path, search] of [
      ["/meus-sites", ""],
      ["/cadastro", "?voltar=%2Fcriar"],
      ["/termos", ""],
      ["/api/sites", ""],
      ["/conta", ""],
    ] as const) {
      expect(route("admin.brotasites.com.br", path, search)).toEqual({
        kind: "redirect",
        location: `https://brotasites.com.br${path}${search}`,
        status: 308,
      });
    }
  });

  it("sends www to the platform's address", () => {
    expect(route("www.brotasites.com.br", "/ajuda", "?q=1")).toEqual({
      kind: "redirect",
      location: "https://brotasites.com.br/ajuda?q=1",
      status: 308,
    });
    // Unknown hosts are left to the hosting (Vercel answers only for the project's domains).
    expect(route("outro.com.br", "/")).toEqual({ kind: "pass", admin: false });
  });

  it("sends the old Vercel address to the platform in production, except infrastructure calls", () => {
    expect(route("brotasites.vercel.app", "/precos", "?a=1")).toEqual({
      kind: "redirect",
      location: "https://brotasites.com.br/precos?a=1",
      status: 308,
    });
    for (const path of ["/api/cron/keep-alive", "/api/jobs/site"]) {
      expect(route("brotasites.vercel.app", path)).toEqual({ kind: "pass", admin: false });
    }
    // Not in previews or locally, and not while the platform still lives there.
    expect(route("brotasites.vercel.app", "/", "", production, false)).toEqual({
      kind: "pass",
      admin: false,
    });
    const onVercel = readHosts({ NEXT_PUBLIC_PLATFORM_URL: "https://brotasites.vercel.app" });
    expect(route("brotasites.vercel.app", "/", "", onVercel)).toEqual({
      kind: "pass",
      admin: false,
    });
  });

  it("keeps a local admin host's port, for tests", () => {
    const local = readHosts({
      NEXT_PUBLIC_PLATFORM_URL: "http://localhost:3101",
      NEXT_PUBLIC_ADMIN_HOST: "admin.localhost:3101",
    });
    expect(route("localhost:3101", "/admin", "", local, false)).toEqual({
      kind: "redirect",
      location: "http://admin.localhost:3101/admin",
      status: 308,
    });
    expect(route("admin.localhost:3101", "/admin", "", local, false)).toEqual({
      kind: "pass",
      admin: true,
    });
  });
});
