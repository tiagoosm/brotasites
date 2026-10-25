import { expect, test } from "@playwright/test";

// The home page demo: type a name, pick a type, see a miniature of the site, and carry both
// answers into the first question. Nothing is saved before the form.

test("the miniature follows the name and type, and the answers reach the form", async ({
  page,
}) => {
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
  await expect(demo.getByRole("status")).toHaveText("Prévia: Barbearia do Léo, barbearia.");

  await demo.getByRole("button", { name: "Continuar com este site" }).click();
  await expect(page).toHaveURL(/\/criar\/negocio$/);
  await expect(page.getByLabel("Nome do negócio")).toHaveValue("Barbearia do Léo");
  await expect(page.getByRole("radio", { name: "Barbearia" })).toBeChecked();
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
  await expect(page).toHaveURL(/\/criar\/negocio\?nome=Oficina\+do\+Beto&tipo=oficina$/);
  await context.close();
});
