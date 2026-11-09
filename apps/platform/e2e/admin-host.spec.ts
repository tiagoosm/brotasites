import { expect, test } from "@playwright/test";
import { createUser, ownIp, PASSWORD, uniqueEmail } from "./support/accounts";

// The team's area on its own host (E28): the second server of playwright.config.ts runs the
// same build with NEXT_PUBLIC_ADMIN_HOST=admin.localhost:3101. /admin moves there for good, the
// admin host serves only the team's area and signing in, and its session is its own. Here the
// platform answers as platform.localhost: Next.js shortens a redirect to the address the server
// was reached at into a bare path, which a real deployment (one name per host) never meets.

const PLATFORM = "http://platform.localhost:3101";
const ADMIN = "http://admin.localhost:3101";
// Node does not resolve *.localhost (Chromium does): requests reach the server by its port
// and name the host in the header, as a browser would.
const SERVER = "http://localhost:3101";
const on = (host: string) => ({ headers: { host }, maxRedirects: 0 });
const platformHost = "platform.localhost:3101";
const adminHost = "admin.localhost:3101";

// biome-ignore lint/correctness/noEmptyPattern: Playwright reads the fixtures from this pattern
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "one browser is enough for host routing");
});

test("the platform's /admin moves to the admin host, permanently, with its path and query", async ({
  request,
}) => {
  const moved = await request.get(`${SERVER}/admin/sites/abc?aba=2`, on(platformHost));
  expect(moved.status()).toBe(308);
  expect(moved.headers().location).toBe(`${ADMIN}/admin/sites/abc?aba=2`);
  // The team's API answers only on the team's host.
  expect((await request.get(`${SERVER}/api/admin/queue`, on(platformHost))).status()).toBe(404);
  // The platform itself is untouched.
  expect((await request.get(`${SERVER}/`, on(platformHost))).status()).toBe(200);
});

test("the admin host serves only the team's area and signing in", async ({ request }) => {
  const get = (path: string) => request.get(`${SERVER}${path}`, on(adminHost));
  const root = await get("/");
  expect(root.status()).toBe(307);
  expect(root.headers().location).toBe(`${ADMIN}/admin`);
  const bare = await get("/entrar");
  expect(bare.headers().location).toBe(`${ADMIN}/entrar?voltar=%2Fadmin`);
  for (const path of ["/meus-sites", "/cadastro?voltar=%2Fcriar", "/termos"]) {
    const away = await get(path);
    expect(away.status(), path).toBe(308);
    expect(away.headers().location, path).toBe(`${PLATFORM}${path}`);
  }
  // Without a session the team's area asks to sign in, on the admin host itself.
  const admin = await get("/admin");
  expect(admin.status()).toBe(307);
  expect(admin.headers().location).toMatch(/\/entrar\?voltar=%2Fadmin$/);
  expect(admin.headers()["x-robots-tag"]).toContain("noindex");
  // Never indexed.
  const robots = await get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /");
  expect((await get("/api/admin/queue")).status()).not.toBe(404);
});

test("the admin host has its own session, and signing in there returns to the team's area", async ({
  page,
  context,
  request,
}) => {
  await ownIp(context);
  const email = uniqueEmail("equipe");
  await createUser(request, { email });
  // Signed in on the platform…
  await page.goto(`${PLATFORM}/entrar`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(`${PLATFORM}/meus-sites`);
  // …the team's area still asks to sign in: the cookie never leaves its host.
  await page.goto(`${PLATFORM}/admin`);
  await expect(page).toHaveURL(`${ADMIN}/entrar?voltar=%2Fadmin`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  // Back to the team's area, on the team's host (closed to clients, as before).
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acesso restrito");
  // A link to the client pages goes back to the platform.
  await page.goto(`${ADMIN}/meus-sites`);
  await expect(page).toHaveURL(`${PLATFORM}/meus-sites`);
});
