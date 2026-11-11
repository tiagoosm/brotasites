import { expect, test } from "@playwright/test";
import { createUser, ownIp, PASSWORD, uniqueEmail } from "./support/accounts";
import { SUPABASE } from "./support/supabase";

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
  // Signing in there is the team's own sign-in (E33).
  const bare = await get("/entrar");
  expect(bare.headers().location).toBe(`${ADMIN}/entrar/equipe?voltar=%2Fadmin`);
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
  // …the team's area still asks to sign in: the cookie never leaves its host. It is the team's
  // own sign-in (E33), and an account that is not on the team is signed out at once.
  await page.goto(`${PLATFORM}/admin`);
  await expect(page).toHaveURL(`${ADMIN}/entrar/equipe?voltar=%2Fadmin`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Esta conta não tem acesso à área da equipe.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para o site" })).toBeVisible();
  await page.goto(`${ADMIN}/admin`);
  await expect(page).toHaveURL(`${ADMIN}/entrar/equipe?voltar=%2Fadmin`);
  // A link to the client pages goes back to the platform.
  await page.goto(`${ADMIN}/meus-sites`);
  await expect(page).toHaveURL(`${PLATFORM}/meus-sites`);
});

const signInAsTeam = async (page: import("@playwright/test").Page, email: string) => {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
};

test("the team's own sign-in: nothing of the clients' site (E33)", async ({ page }) => {
  await page.goto(`${ADMIN}/entrar`);
  await expect(page).toHaveURL(`${ADMIN}/entrar/equipe?voltar=%2Fadmin`);
  await expect(page).toHaveTitle(/Entrar na área da equipe/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Área da equipe");
  await expect(page.getByRole("banner").getByText("Área da equipe")).toBeVisible();
  for (const name of [
    "Criar conta",
    "Cadastre-se",
    "Como funciona",
    "Preço",
    "Ajuda",
    "Esqueci a senha",
  ]) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "Abrir menu" })).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  // The clients' sign-in on the platform is unchanged.
  await page.goto(`${PLATFORM}/entrar`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entre na sua conta");
  await expect(page.getByRole("link", { name: "Cadastre-se" })).toBeVisible();
});

// The switch lives in the one fake server: these run one after the other, never alongside.
test.describe("the team's switch (E33)", () => {
  test.describe.configure({ mode: "serial" });
  test.afterEach(async ({ request }) => {
    await request.post(`${SUPABASE}/__test/second-factor`, { data: { on: false } });
  });

  test("a team account goes straight in, with the reminder that the second step is off (E33)", async ({
    page,
    context,
    request,
  }) => {
    await ownIp(context);
    const email = uniqueEmail("equipe-direto");
    const user = await createUser(request, { email });
    await request.post(`${SUPABASE}/__test/team`, { data: { userId: user.id } });
    // A "voltar" outside the team's area is ignored.
    await page.goto(
      `${ADMIN}/entrar/equipe?voltar=${encodeURIComponent("https://example.com/admin")}`,
    );
    await signInAsTeam(page, email);
    await expect(page).toHaveURL(`${ADMIN}/admin`);
    await expect(page.getByText("A verificação em duas etapas está desligada.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verificação em duas etapas" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Área da equipe" })).toBeVisible();
    // Already signed in: the sign-in page leads back to the team's area.
    await page.goto(`${ADMIN}/entrar/equipe?voltar=%2Fadmin%2Fcontas`);
    await expect(page).toHaveURL(`${ADMIN}/admin/contas`);
  });

  test("the second step comes back for the team (E33)", async ({ page, context, request }) => {
    await ownIp(context);
    const email = uniqueEmail("equipe-codigo");
    const user = await createUser(request, { email });
    await request.post(`${SUPABASE}/__test/team`, { data: { userId: user.id } });
    await request.post(`${SUPABASE}/__test/second-factor`, { data: { on: true } });
    await page.goto(`${ADMIN}/entrar/equipe?voltar=%2Fadmin`);
    await signInAsTeam(page, email);
    await expect(page).toHaveURL(`${ADMIN}/admin`);
    await expect(page.getByRole("heading", { name: "Verificação em duas etapas" })).toBeVisible();
    await expect(page.getByText("A verificação em duas etapas está desligada.")).toHaveCount(0);
  });
});
