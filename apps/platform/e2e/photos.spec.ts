import { readFileSync } from "node:fs";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";

// Photo uploads (question 6). Supabase is the fake e2e project: the session is a cookie made
// here and every auth, database and storage call is answered by the test.

const SUPABASE = "https://e2e-test.supabase.co";
const USER = { id: "user-1", email: "ze@padariadoze.com.br" };
const SITE = "site-1";
const photo = new URL("../../../packages/templates/e2e/fixture/assets/hero.jpg", import.meta.url);
const photoBytes = readFileSync(photo);
const photoFile = (name: string) => ({ name, mimeType: "image/jpeg", buffer: photoBytes });

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;
const site = (page: Page) => page.frameLocator('iframe[data-active="true"]');
const card = (page: Page) => page.getByRole("group", { name: "Fotos", exact: true });

const base64url = (value: string) => Buffer.from(value).toString("base64url");

/** A session cookie in the format @supabase/ssr reads. The token is checked via /auth/v1/user. */
async function signIn(context: BrowserContext) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    base64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    base64url(
      JSON.stringify({
        sub: USER.id,
        email: USER.email,
        role: "authenticated",
        aud: "authenticated",
        exp,
      }),
    ),
    "assinatura",
  ].join(".");
  const user = {
    ...USER,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-21T00:00:00Z",
  };
  const session = {
    access_token: token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: "r",
    user,
  };
  await context.addCookies([
    {
      name: "sb-e2e-test-auth-token",
      value: `base64-${base64url(JSON.stringify(session))}`,
      domain: "localhost",
      path: "/",
    },
  ]);
  return user;
}

interface Calls {
  uploads: { path: string; type: string | null }[];
  removed: string[];
}

async function fakeSupabase(context: BrowserContext, user: object): Promise<Calls> {
  const calls: Calls = { uploads: [], removed: [] };
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  await context.route(`${SUPABASE}/auth/v1/user`, (route) => route.fulfill(json(user)));
  await context.route(`${SUPABASE}/rest/v1/**`, (route) => {
    const request = route.request();
    const table = new URL(request.url()).pathname.split("/").pop();
    const method = request.method();
    if (table === "sites" && method === "GET") return route.fulfill(json(null));
    if (table === "sites" && method === "POST") return route.fulfill(json({ id: SITE }, 201));
    if (method === "PATCH") return route.fulfill(json([]));
    return route.fulfill(json(method === "POST" ? [] : null, method === "POST" ? 201 : 200));
  });
  await context.route(`${SUPABASE}/storage/v1/object/public/**`, (route) =>
    route.fulfill({ status: 200, contentType: "image/jpeg", body: photoBytes }),
  );
  await context.route(`${SUPABASE}/storage/v1/object/site-images**`, (route) => {
    const request = route.request();
    if (request.method() === "DELETE") {
      const body = request.postDataJSON() as { prefixes?: string[] };
      calls.removed.push(...(body.prefixes ?? []));
      return route.fulfill(json([]));
    }
    const path = new URL(request.url()).pathname.replace("/storage/v1/object/site-images/", "");
    calls.uploads.push({ path, type: request.headers()["content-type"] ?? null });
    return route.fulfill(json({ Key: `site-images/${path}`, Id: "1" }));
  });
  return calls;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("brotasites:rascunho:v1")) return;
    window.localStorage.setItem(
      "brotasites:rascunho:v1",
      JSON.stringify({
        draft: {
          business: {
            name: "Padaria do Zé",
            category: "Padaria",
            contact: { address: { city: "Santa Rita do Sapucaí" } },
          },
        },
        completed: ["negocio", "modelo", "cores", "secoes", "conteudo"],
        updatedAt: Date.now(),
      }),
    );
  });
});

test("photos ask to sign in first", async ({ page }) => {
  await page.goto("/criar/contato");
  await expect(card(page).getByRole("link", { name: "Entrar para enviar fotos" })).toHaveAttribute(
    "href",
    "/entrar?voltar=%2Fcriar%2Fcontato",
  );
});

test("uploads photos as WebP into the person's folder", async ({ page, context }) => {
  const calls = await fakeSupabase(context, await signIn(context));
  await page.goto("/criar/contato");
  const photos = card(page);

  await photos.getByLabel("Foto do topo").setInputFiles(photoFile("fachada.jpg"));
  const thumb = photos.getByRole("img", { name: "Foto do topo" });
  await expect(thumb).toHaveAttribute(
    "src",
    new RegExp(`/storage/v1/object/public/site-images/${USER.id}/${SITE}/[\\w-]+\\.webp$`),
  );
  expect(calls.uploads).toHaveLength(1);
  expect(calls.uploads[0]?.path).toMatch(new RegExp(`^${USER.id}/${SITE}/[\\w-]+\\.webp$`));

  await photos
    .getByLabel("Adicionar fotos à galeria")
    .setInputFiles([photoFile("pao.jpg"), photoFile("bolo.jpg")]);
  const gallery = photos.getByRole("list", { name: "Fotos da galeria" });
  await expect(gallery.getByRole("img")).toHaveCount(2);
  await photos.getByRole("button", { name: "Remover foto 1 da galeria" }).click();
  await expect(gallery.getByRole("img")).toHaveCount(1);
  await expect.poll(() => calls.removed.length).toBe(1);

  if (isMobile(page)) await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(site(page).locator("#hero img")).toHaveAttribute(
    "src",
    new RegExp(`/site-images/${USER.id}/${SITE}/`),
    { timeout: 15_000 },
  );
  await expect(site(page).locator("#galeria img")).toHaveCount(1);
});

test("files that are not photos are refused with an explanation", async ({ page, context }) => {
  const calls = await fakeSupabase(context, await signIn(context));
  await page.goto("/criar/contato");
  await card(page)
    .getByLabel("Foto do topo")
    .setInputFiles({
      name: "cardapio.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF"),
    });
  await expect(card(page).getByText("Escolha uma foto em JPG, PNG ou WebP.")).toBeVisible();
  expect(calls.uploads).toHaveLength(0);
});
