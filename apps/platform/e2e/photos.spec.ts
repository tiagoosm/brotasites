import { expect, type Page, test } from "@playwright/test";
import { fakeSupabase, photoBytes, SITE, signIn, USER } from "./support/supabase";

// Photo uploads (question 6), against the fake Supabase in support/supabase.ts.

const photoFile = (name: string) => ({ name, mimeType: "image/jpeg", buffer: photoBytes });

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;
const site = (page: Page) => page.frameLocator('iframe[data-active="true"]');
const card = (page: Page) => page.getByRole("group", { name: "Fotos", exact: true });

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
