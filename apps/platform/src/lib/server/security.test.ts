import { describe, expect, it } from "vitest";
import { captchaMode, captchaTokenFor } from "./captcha";
import { contentSecurityPolicy, isPrivatePath, isProtectedPath } from "./csp";
import { limitKey, maskEmail, sameOrigin } from "./guard";
import { rulesFor, withinLimits } from "./rate-limit";
import { signedInRecently } from "./session";

const post = (origin: string | null, url = "https://brotasites.vercel.app/api/auth/sign-in") =>
  new Request(url, { method: "POST", headers: origin ? { origin } : {} });

describe("origin check (CSRF)", () => {
  it("accepts only the platform's own pages", () => {
    expect(sameOrigin(post("https://brotasites.vercel.app"))).toBe(true);
    expect(sameOrigin(post("https://evil.com"))).toBe(false);
    expect(sameOrigin(post("https://brotasites.vercel.app.evil.com"))).toBe(false);
    expect(sameOrigin(post("null"))).toBe(false);
    expect(sameOrigin(post(null))).toBe(false);
  });
});

describe("rate limits", () => {
  it("counts every rule and refuses when one is full", async () => {
    const counts = new Map<string, number>();
    const limiter = async (rule: { key: string; max: number }) => {
      const used = (counts.get(rule.key) ?? 0) + 1;
      counts.set(rule.key, used);
      return used <= rule.max;
    };
    const rules = rulesFor("signUp", "203.0.113.9", "ze@padariadoze.com.br", limitKey);
    expect(rules.map((rule) => rule.max)).toEqual([5, 3]);
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await withinLimits(rules, limiter));
    expect(results).toEqual([true, true, true, false]);
  });

  it("never stores the email or the IP itself", () => {
    const key = limitKey("signIn-email", "ze@padariadoze.com.br");
    expect(key).toMatch(/^signIn-email:[0-9a-f]{40}$/);
    expect(key).not.toContain("padaria");
    expect(limitKey("signIn-email", "ZE@padariadoze.com.br")).toBe(key);
    expect(maskEmail("ze@padariadoze.com.br")).toBe("z***@padariadoze.com.br");
  });

  it("without the database: allowed in development, refused in production", async () => {
    const before = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";
    expect(await withinLimits([], null)).toBe(false);
    process.env.VERCEL_ENV = "preview";
    expect(await withinLimits([], null)).toBe(true);
    process.env.VERCEL_ENV = before;
  });
});

describe("CAPTCHA (Turnstile through Supabase)", () => {
  it("is never off in production", () => {
    expect(captchaMode({ VERCEL_ENV: "production" })).toBe("misconfigured");
    expect(
      captchaMode({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_CAPTCHA_MODE: "simulated",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4",
      }),
    ).toBe("misconfigured");
    expect(captchaMode({ VERCEL_ENV: "production", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4" })).toBe(
      "turnstile",
    );
    expect(captchaMode({})).toBe("simulated");
    // Testing before launch: off on purpose, even in production and with a site key.
    expect(captchaMode({ VERCEL_ENV: "production", NEXT_PUBLIC_CAPTCHA_MODE: "off" })).toBe("off");
    expect(
      captchaTokenFor("tok", {
        VERCEL_ENV: "production",
        NEXT_PUBLIC_CAPTCHA_MODE: "off",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4",
      }),
    ).toEqual({});
    expect(captchaMode({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4" })).toBe("turnstile");
  });

  it("refuses a request without a token when the widget is on", () => {
    const on = { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4" };
    expect(captchaTokenFor(undefined, on)).toBeNull();
    expect(captchaTokenFor("tok", on)).toEqual({ token: "tok" });
    expect(captchaTokenFor(undefined, {})).toEqual({});
    expect(captchaTokenFor("tok", { VERCEL_ENV: "production" })).toBeNull();
  });
});

describe("recent sign-in", () => {
  const now = Date.UTC(2026, 9, 29, 12);
  const at = (minutesAgo: number) => Math.floor(now / 1000) - minutesAgo * 60;
  it("counts real sign-ins of the last 10 minutes, not token refreshes", () => {
    expect(signedInRecently([{ method: "password", timestamp: at(3) }], now)).toBe(true);
    expect(signedInRecently([{ method: "otp", timestamp: at(30) }], now)).toBe(false);
    expect(
      signedInRecently(
        [
          { method: "token_refresh", timestamp: at(1) },
          { method: "password", timestamp: at(60) },
        ],
        now,
      ),
    ).toBe(false);
    expect(signedInRecently([{ method: "recovery", timestamp: at(9) }], now)).toBe(true);
    expect(signedInRecently(undefined, now)).toBe(false);
  });
});

describe("pages and CSP", () => {
  it("protects the signed-in area and keeps account pages out of caches", () => {
    for (const path of [
      "/painel",
      "/criar",
      "/criar/1/negocio",
      "/meus-sites",
      "/meus-sites/1",
      "/conta",
      "/admin/catalogo",
    ]) {
      expect(isProtectedPath(path), path).toBe(true);
    }
    for (const path of ["/", "/entrar", "/cadastro", "/criarx", "/painelx", "/termos"]) {
      expect(isProtectedPath(path), path).toBe(false);
    }
    expect(isPrivatePath("/entrar")).toBe(true);
    expect(isPrivatePath("/painel")).toBe(true);
    expect(isPrivatePath("/api/notifications/read")).toBe(true);
    expect(isPrivatePath("/api/account/export")).toBe(true);
    expect(isPrivatePath("/ajuda")).toBe(false);
  });

  it("gives the app pages a nonce and no inline scripts", () => {
    const env = { NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" };
    const app = contentSecurityPolicy("bm9uY2U=", env);
    expect(app).toContain(
      "script-src 'self' 'nonce-bm9uY2U=' 'strict-dynamic' https://challenges.cloudflare.com",
    );
    expect(app).not.toContain("unsafe-eval");
    expect(app).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(app).toContain("frame-ancestors 'none'");
    expect(app).toContain("object-src 'none'");
    expect(contentSecurityPolicy(null, env)).toContain("script-src 'self' 'unsafe-inline'");
  });
});
