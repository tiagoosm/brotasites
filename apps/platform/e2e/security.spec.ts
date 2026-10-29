import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
  BASE,
  createUser,
  ownIp,
  PASSWORD,
  signInWithPassword,
  uniqueEmail,
} from "./support/accounts";
import { SESSION_COOKIE } from "./support/supabase";

// Security of the accounts (E15, docs/security.md): pages and routes refused without a session
// on the server, cross-site writes refused, no open redirects, a host-only session cookie and
// no secrets in answers.

test.beforeEach(async ({ context }) => {
  await ownIp(context);
});

test("the signed-in pages turn people away on the server", async ({ request }) => {
  const expected: Record<string, string> = {
    "/criar": "/cadastro?voltar=%2Fcriar",
    "/criar/7d1c1a52-2f0e-4c39-9a35-6b1f4a8e2c10/negocio":
      "/entrar?voltar=%2Fcriar%2F7d1c1a52-2f0e-4c39-9a35-6b1f4a8e2c10%2Fnegocio",
    "/meus-sites": "/entrar?voltar=%2Fmeus-sites",
    "/conta": "/entrar?voltar=%2Fconta",
    "/admin": "/entrar?voltar=%2Fadmin",
  };
  for (const [path, target] of Object.entries(expected)) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers().location, path).toBe(target);
  }
  const page = await request.get("/entrar");
  expect(page.headers()["cache-control"]).toContain("no-store");
  expect(page.headers()["x-robots-tag"]).toBe("noindex");
  expect(page.headers()["content-security-policy"]).toMatch(
    /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
  );
});

/** Every route handler of the platform, from the folders (so a new route is covered too). */
function apiRoutes(
  dir = fileURLToPath(new URL("../src/app/api", import.meta.url)),
  prefix = "/api",
): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      const segment = entry.startsWith("[") ? "7d1c1a52-2f0e-4c39-9a35-6b1f4a8e2c10" : entry;
      routes.push(...apiRoutes(path, `${prefix}/${segment}`));
    } else if (entry === "route.ts") routes.push(prefix);
  }
  return routes;
}

// The account routes that work without a session on purpose (signing up and in).
const PUBLIC = [
  "/api/auth/sign-up",
  "/api/auth/sign-in",
  "/api/auth/link",
  "/api/auth/recover",
  "/api/auth/resend",
];

test("no route answers without a session, and none takes a write from another site", async ({
  request,
}) => {
  const routes = apiRoutes().filter((route) => !PUBLIC.includes(route));
  expect(routes.length).toBeGreaterThan(15);
  for (const route of routes) {
    const get = await request.get(route);
    expect([401, 404, 405], `GET ${route}`).toContain(get.status());
    const post = await request.post(route, { headers: { origin: BASE }, data: {} });
    // 400 is a body refused before anything is read; nothing answers 2xx.
    expect([400, 401, 404, 405, 415], `POST ${route}`).toContain(post.status());
    const foreign = await request.post(route, {
      headers: { origin: "https://evil.example" },
      data: {},
    });
    expect(foreign.status(), `cross-site POST ${route}`).toBe(403);
  }
  for (const route of PUBLIC) {
    const foreign = await request.post(route, {
      headers: { origin: "https://evil.example" },
      data: { email: "a@b.co" },
    });
    expect(foreign.status(), route).toBe(403);
    const none = await request.post(route, { data: { email: "a@b.co" } });
    expect(none.status(), `${route} without Origin`).toBe(403);
  }
});

test("after signing in the person never leaves the platform", async ({ page, request }) => {
  const email = uniqueEmail("redirect");
  await createUser(request, { email });
  for (const voltar of [
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/\t/evil.com",
  ]) {
    await page.context().clearCookies();
    await signInWithPassword(page, email, PASSWORD, voltar);
    await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
    expect(new URL(page.url()).origin, voltar).toBe(BASE);
  }
  for (const next of ["https%3A%2F%2Fevil.com", "%2F%2Fevil.com", "%2F%5Cevil.com"]) {
    const response = await request.get(`/auth/confirm?next=${next}`, { maxRedirects: 0 });
    expect(new URL(response.headers().location ?? "", BASE).origin).toBe(BASE);
  }
});

test("the session cookie stays on the platform's own host", async ({ page, request, context }) => {
  const email = uniqueEmail("cookie");
  await createUser(request, { email });
  await signInWithPassword(page, email, PASSWORD, "/conta");
  await expect(page).toHaveURL(/\/conta$/);
  const cookie = (await context.cookies()).find((item) => item.name.startsWith(SESSION_COOKIE));
  expect(cookie).toBeDefined();
  // Host-only (no Domain attribute: Playwright shows the bare host), Lax, the whole platform.
  expect(cookie?.domain).toBe("localhost");
  expect(cookie?.sameSite).toBe("Lax");
  expect(cookie?.path).toBe("/");
  // No Domain attribute, so the client sites' domain never receives it.
  const answer = await request.post("/api/auth/sign-in", {
    headers: { origin: BASE },
    data: { email, password: PASSWORD },
  });
  const setCookies = answer
    .headersArray()
    .filter((header) => header.name.toLowerCase() === "set-cookie");
  expect(setCookies.length).toBeGreaterThan(0);
  for (const header of setCookies) expect(header.value).not.toMatch(/domain=/i);
});

test("answers carry no secrets", async ({ request }) => {
  const bodies = [
    await request.post("/api/auth/sign-in", {
      headers: { origin: BASE },
      data: { email: "x@padariadoze.com.br", password: "errada-1234" },
    }),
    await request.post("/api/auth/sign-up", {
      headers: { origin: BASE },
      data: {
        fullName: "Zé",
        email: "y@padariadoze.com.br",
        password: "1234567890",
        acceptTerms: true,
      },
    }),
    await request.get("/api/account/export"),
  ];
  for (const response of bodies) {
    const text = await response.text();
    for (const secret of [
      "sb_secret",
      "sb_publishable_e2e_test_secret",
      "access_token",
      "refresh_token",
      "Pao-quente",
    ]) {
      expect(text, secret).not.toContain(secret);
    }
  }
});
