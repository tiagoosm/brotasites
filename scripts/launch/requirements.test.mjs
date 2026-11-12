import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkTarget,
  GENERATION_ON_VERCEL,
  isPlaceholder,
  nextAction,
  onlineChecks,
  parseEnv,
  STEP_ORDER,
  STEPS,
  VARIABLES,
  workerEnvFromWrangler,
} from "./requirements.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("what production needs (E34)", () => {
  it("keeps the platform's generation list equal to generationReady()'s", () => {
    const source = readFileSync(join(root, "apps/platform/src/lib/server/generation.ts"), "utf8");
    const block = /GENERATION_VARIABLES = \[([\s\S]*?)\]/.exec(source)?.[1] ?? "";
    const names = [...block.matchAll(/"([A-Z0-9_]+)"/g)].map((m) => m[1]);
    expect(names.sort()).toEqual([...GENERATION_ON_VERCEL].sort());
  });

  it("covers every variable the platform, the jobs and the Worker read", () => {
    const listed = new Set(VARIABLES.map((v) => v.name));
    // Read in code but not production settings: tests, build tools, Next.js and Vercel's own.
    const notSettings = new Set([
      "NODE_ENV",
      "VERCEL_ENV",
      "PW_CHROMIUM",
      "BROTASITES_STRICT_HOSTS",
      "BROTASITES_STRICT_GENERATION",
      "BROTASITES_CONFIG",
      "BROTASITES_BASE",
      "BROTASITES_LAB",
      "LOCAL_PREVIEWS_DIR",
      "LOCAL_PREVIEWS_PORT",
      "TRIGGER_PROJECT_REF",
      "SUPABASE_URL",
      "SITES",
      "HOSTING",
      "E2E_RUN",
    ]);
    const read = new Set();
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (["node_modules", ".next", "dist", "e2e", "test", ".turbo"].includes(entry.name))
          continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          const text = readFileSync(path, "utf8");
          for (const m of text.matchAll(/(?:process\.env|\benv)\.([A-Z][A-Z0-9_]{2,})/g))
            read.add(m[1]);
        }
      }
    };
    for (const dir of ["apps/platform/src", "apps/jobs/src", "apps/sites-worker/src", "packages"]) {
      walk(join(root, dir));
    }
    const unlisted = [...read].filter((name) => !listed.has(name) && !notSettings.has(name));
    expect(unlisted).toEqual([]);
  });

  it("names a step for every variable, in an order the owner can follow", () => {
    for (const v of VARIABLES) expect(STEPS[v.step], v.name).toBeTruthy();
    expect(new Set(STEP_ORDER)).toEqual(new Set(Object.keys(STEPS)));
  });

  it("spots example values", () => {
    for (const value of [
      "sites.localhost",
      "http://127.0.0.1:4500",
      "00000000000000000000000000000000",
      "change-me",
      "https://<project>.supabase.co",
    ]) {
      expect(isPlaceholder(value), value).toBe(true);
    }
    for (const value of ["brotasites.com", "https://previa.brotasites.com", "tr_prod_abc"]) {
      expect(isPlaceholder(value), value).toBe(false);
    }
  });

  it("lists what Vercel lacks today, never a value", () => {
    // As the owner reported on 2026-11-12: only the two addresses (and Supabase, working).
    const env = {
      NEXT_PUBLIC_PLATFORM_URL: "https://brotasites.com.br",
      NEXT_PUBLIC_ADMIN_HOST: "admin.brotasites.com.br",
      SUPABASE_SECRET_KEY: "sb_secret_this_must_never_print",
      NEXT_PUBLIC_PREVIEW_ORIGIN: "http://127.0.0.1:4500",
      TRIGGER_SECRET_KEY: "",
    };
    const result = checkTarget("vercel", env);
    expect(result.ok).toBe(false);
    const state = Object.fromEntries(result.rows.map((r) => [r.name, r.state]));
    expect(state.SUPABASE_SECRET_KEY).toBe("presente");
    expect(state.NEXT_PUBLIC_BASE_DOMAIN).toBe("faltando");
    expect(state.TRIGGER_SECRET_KEY).toBe("vazia");
    expect(state.NEXT_PUBLIC_PREVIEW_ORIGIN).toBe("exemplo");
    // Without Turnstile and without "off", the captcha key is required.
    expect(result.blocking.map((b) => b.name)).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(JSON.stringify(result)).not.toContain("sb_secret_this_must_never_print");
    expect(nextAction([result])).toMatch(/^Próxima ação: Conferir na Vercel/);
  });

  it("accepts the captcha off until Turnstile, never simulated", () => {
    const off = checkTarget("vercel", { NEXT_PUBLIC_CAPTCHA_MODE: "off" });
    expect(off.blocking.map((b) => b.name)).not.toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    const simulated = checkTarget("vercel", { NEXT_PUBLIC_CAPTCHA_MODE: "simulated" });
    expect(simulated.rows.find((r) => r.name === "NEXT_PUBLIC_CAPTCHA_MODE")?.state).toBe(
      "valor errado",
    );
  });

  it("asks the jobs for the live AI", () => {
    const result = checkTarget("trigger", { AI_MODE: "simulated" });
    expect(result.rows.find((r) => r.name === "AI_MODE")?.state).toBe("valor errado");
  });

  it("refuses the Worker's zero KV id, reads its domains from wrangler.jsonc", () => {
    const wrangler = workerEnvFromWrangler(
      readFileSync(join(root, "apps/sites-worker/wrangler.jsonc"), "utf8"),
    );
    expect(wrangler.BASE_DOMAIN).toBe("brotasites.com");
    expect(wrangler.PLATFORM_URL).toBe("https://brotasites.com.br");
    const result = checkTarget("worker", wrangler);
    expect(result.rows.find((r) => r.name === "KV_NAMESPACE_ID")?.state).toBe("exemplo");
    expect(result.ok).toBe(false);
  });

  it("reads dotenv files", () => {
    expect(parseEnv('# c\nA=1\nexport B="two words"\nC=three # note\nD=\n bad line\n')).toEqual({
      A: "1",
      B: "two words",
      C: "three",
      D: "",
    });
  });

  it("checks the addresses through an injected fetch, in Portuguese", async () => {
    const answers = {
      "https://brotasites.com.br": { status: 200 },
      "https://admin.brotasites.com.br/robots.txt": {
        status: 200,
        body: "User-agent: *\nDisallow: /\n",
      },
      "https://previa.brotasites.com/": { status: 404 },
      "https://brotasites.com/": { status: 308, location: "https://brotasites.com.br/" },
      "https://teste-brotasites-check.brotasites.com/": { status: 404 },
    };
    const checks = await onlineChecks(
      {
        platformUrl: "https://brotasites.com.br",
        adminHost: "admin.brotasites.com.br",
        baseDomain: "brotasites.com",
      },
      async (url) => answers[url],
    );
    expect(checks.every((c) => c.ok)).toBe(true);
    const down = await onlineChecks(
      { platformUrl: "https://brotasites.com.br", adminHost: "", baseDomain: "brotasites.com" },
      async () => {
        throw new Error("getaddrinfo ENOTFOUND");
      },
    );
    expect(down.every((c) => !c.ok)).toBe(true);
    expect(down[0]?.detail).toMatch(/não respondeu/);
  });
});
