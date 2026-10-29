import { expect, test } from "@playwright/test";
import { fakeSupabase, SITE, signIn } from "./support/supabase";

// The home page demo: type a name, pick a type, see a miniature of the site, and carry both
// answers into the first question. Nothing is saved before the form.

test("the miniature follows the name and type, and the answers reach the form", async ({
  page,
  context,
}) => {
  const state = await fakeSupabase(context, await signIn(context));
  await page.goto("/");
  const demo = page.getByRole("form", { name: "Experimente aqui" });
  const miniature = demo.locator(".demo-site");
  await expect(miniature).toContainText("Padaria do Zé");
  await expect(miniature).toContainText("Pão quentinho todo dia");

  await demo.getByLabel("Nome do seu negócio").fill("Barbearia do Léo");
  await demo.getByText("Barbearia", { exact: true }).click();
  await expect(miniature).toContainText("Barbearia do Léo");
  await expect(miniature).toContainText("Corte e barba sem pressa");
  await expect(miniature).toHaveCSS("background-color", "rgb(244, 245, 247)");
  await expect(demo.getByText("barbearia-do-leo.brotasites.com")).toBeVisible();
  await expect(demo.getByRole("status")).toHaveText("Amostra: Barbearia do Léo, barbearia.");

  await demo.getByRole("button", { name: "Continuar com este site" }).click();
  await expect(page).toHaveURL(new RegExp(`/criar/${SITE}/negocio$`));
  await expect(page.getByLabel("Nome do negócio")).toHaveValue("Barbearia do Léo");
  await expect(page.getByText("Beleza e bem-estar")).toBeVisible();
  expect(state.draft).toEqual({ business: { name: "Barbearia do Léo", category: "barbearia" } });
});

test("the demo stores nothing until the form", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome do seu negócio").fill("Salão da Ana");
  const stored = await page.evaluate(() => window.localStorage.getItem("brotasites:rascunho:v1"));
  expect(stored).toBeNull();
});

test("without JavaScript the demo still shows the example and sends the answers", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  const demo = page.getByRole("form", { name: "Experimente aqui" });
  await expect(demo.locator(".demo-site")).toContainText("Padaria do Zé");
  await demo.getByLabel("Nome do seu negócio").fill("Oficina do Beto");
  await demo.getByText("Oficina mecânica", { exact: true }).click();
  await demo.getByRole("button", { name: "Continuar com este site" }).click();
  // Without an account, the answers wait in the address while the person signs up.
  await expect(page).toHaveURL(
    /\/cadastro\?voltar=%2Fcriar%3Fnome%3DOficina%2Bdo%2BBeto%26tipo%3Doficina-mecanica$/,
  );
  await context.close();
});
