import { describe, expect, it } from "vitest";
import { captchaDiagnosis, captchaMissing, captchaRefused, siteKeyFormat } from "./captcha";
import { contentSecurityPolicy, isAppPath } from "./csp";

// E44: what the team sees about the bot check (never the key), and the policy that lets
// Turnstile's script, frame and requests through on every page that shows the widget.

const PROD_KEY = "0x4AAAAAAAAbcdefghijklmn";

describe("the bot check's diagnosis (E44)", () => {
  it("tells production keys from Cloudflare's test keys, and never echoes the key", () => {
    expect(siteKeyFormat(PROD_KEY)).toBe("production");
    expect(siteKeyFormat("1x00000000000000000000AA")).toBe("test");
    expect(siteKeyFormat("3x00000000000000000000FF")).toBe("test");
    expect(siteKeyFormat("minha-chave")).toBe("unexpected");
    expect(siteKeyFormat(undefined)).toBe("missing");
    expect(siteKeyFormat("  ")).toBe("missing");
    const diagnosis = captchaDiagnosis({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: PROD_KEY,
    });
    expect(diagnosis).toEqual({
      mode: "turnstile",
      siteKey: "production",
      production: true,
      warning: null,
    });
    expect(JSON.stringify(diagnosis)).not.toContain(PROD_KEY);
  });

  it("warns loudly when the check is off in production", () => {
    const diagnosis = captchaDiagnosis({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_CAPTCHA_MODE: "off",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: PROD_KEY,
    });
    expect(diagnosis.mode).toBe("off");
    expect(diagnosis.warning).toBe(
      "A verificação está desligada: ninguém está protegido contra robôs.",
    );
  });

  it("warns when production has no key, a test key or a key in an odd format", () => {
    expect(captchaDiagnosis({ VERCEL_ENV: "production" }).warning).toMatch(/Falta a chave/);
    expect(
      captchaDiagnosis({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      }).warning,
    ).toMatch(/chave de teste/);
    expect(
      captchaDiagnosis({ VERCEL_ENV: "production", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "abc" }).warning,
    ).toMatch(/formato esperado/);
    // Development with the simulated check is normal.
    expect(captchaDiagnosis({ NEXT_PUBLIC_CAPTCHA_MODE: "simulated" }).warning).toBeNull();
  });

  it("says apart a token that never came from one Supabase refused", () => {
    expect(captchaMissing).not.toBe(captchaRefused);
    expect(captchaRefused).toBe("A verificação expirou ou foi recusada. Tente de novo.");
  });
});

describe("the policy lets Turnstile in on every page with the widget (E44)", () => {
  const env = { NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" };
  const directive = (policy: string, name: string) =>
    policy
      .split("; ")
      .find((part) => part.startsWith(`${name} `))
      ?.split(" ") ?? [];

  // /entrar, /cadastro, /esqueci-senha, /conta and /entrar/equipe are rendered with a nonce;
  // the same policy without one covers the prerendered pages.
  it("renders every page with the widget with a nonce", () => {
    for (const path of ["/entrar", "/cadastro", "/esqueci-senha", "/conta", "/entrar/equipe"]) {
      expect(isAppPath(path), path).toBe(true);
    }
  });
  for (const nonce of ["abc123", null]) {
    it(`script, frame and connect allow challenges.cloudflare.com (${nonce ? "with" : "without"} nonce)`, () => {
      const policy = contentSecurityPolicy(nonce, env);
      for (const name of ["script-src", "frame-src", "connect-src"]) {
        expect(directive(policy, name), name).toContain("https://challenges.cloudflare.com");
      }
    });
  }
});
