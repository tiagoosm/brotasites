import { expect, test } from "@playwright/test";

// A second way in for visitors who are not ready to start: a real site made by the
// generator, with a way back.

test("the hero offers an example site besides creating one", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "Criar meu site" })).toHaveCount(3);
  await expect(page.getByRole("banner").getByRole("link", { name: "Criar meu site" })).toHaveCount(
    0,
  );
  await expect(main.getByRole("link", { name: "Ver como funciona" })).toHaveAttribute(
    "href",
    "#como-funciona",
  );
  await expect(main.getByRole("link", { name: "Site de exemplo", exact: true })).toHaveAttribute(
    "href",
    "/exemplo",
  );
  await main.getByRole("link", { name: "Ver um site de exemplo" }).click();
  await expect(page).toHaveURL(/\/exemplo$/);
});

test("the example page shows the generated site, says it is an example and leads back", async ({
  page,
}) => {
  await page.goto("/exemplo");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Site de exemplo");
  const site = page.frameLocator('iframe[title="Site de exemplo da Padaria do Zé"]');
  await expect(site.locator("#hero-title")).toContainText("Pão quentinho");
  await expect(site.locator("body")).toHaveCSS("background-color", /rgb/);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  await page.getByRole("link", { name: "Voltar" }).click();
  await expect(page).toHaveURL(/\/$/);
});
