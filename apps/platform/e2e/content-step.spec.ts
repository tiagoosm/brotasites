import { expect, type Page, test } from "@playwright/test";

// Question 5: the words of each section, straight into the preview.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;
const site = (page: Page) => page.frameLocator('iframe[data-active="true"]');
const card = (page: Page, name: string) => page.getByRole("group", { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("brotasites:rascunho:v1")) return;
    window.localStorage.setItem(
      "brotasites:rascunho:v1",
      JSON.stringify({ draft: {}, completed: ["negocio", "modelo", "cores", "secoes"] }),
    );
  });
  await page.goto("/criar/negocio");
  await page.getByLabel("Nome do negócio").fill("Padaria do Zé");
  await page
    .getByRole("group", { name: "Tipo de negócio" })
    .getByText("Padaria", { exact: true })
    .click();
  await page.getByLabel("Cidade").fill("Santa Rita do Sapucaí");
  await expect(page.getByRole("status").first()).toContainText(/salvo/i);
  await page.goto("/criar/conteudo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O que você quer contar?");
});

async function showPreview(page: Page) {
  if (isMobile(page)) await page.getByRole("button", { name: "Ver prévia" }).click();
}

test("question 5 writes the site's words into the preview", async ({ page }) => {
  const hero = card(page, "Topo");
  await expect(hero.getByLabel("Título")).toHaveAttribute("placeholder", "Padaria do Zé");
  await hero.getByLabel("Título").fill("Pão quentinho todo dia");
  await hero.getByLabel("Frase de apresentação").fill("Fermentação natural desde 1998.");

  const services = card(page, "Serviços");
  await services.getByLabel("Nome").fill("Pão de fermentação natural");
  await services.getByRole("button", { name: "Adicionar serviço" }).click();
  // Focus goes to the new row, ready to type.
  await expect(services.getByLabel("Nome").nth(1)).toBeFocused();
  await page.keyboard.type("Bolos sob encomenda");
  const secondIcon = services.getByRole("group", { name: /serviço 2/ });
  await secondIcon.getByTitle("Bolo").click();
  await expect(secondIcon.getByRole("radio", { name: "Bolo" })).toBeChecked();

  await showPreview(page);
  const frame = site(page);
  await expect(frame.locator("#hero-title")).toHaveText("Pão quentinho todo dia", {
    timeout: 15_000,
  });
  await expect(frame.getByText("Fermentação natural desde 1998.")).toBeVisible();
  await expect(frame.locator("#servicos h3")).toHaveText([
    "Pão de fermentação natural",
    "Bolos sob encomenda",
  ]);
});

test("removing a service keeps the others", async ({ page }) => {
  const services = card(page, "Serviços");
  await services.getByLabel("Nome").fill("Pães");
  await services.getByRole("button", { name: "Adicionar serviço" }).click();
  await page.keyboard.type("Bolos");
  await services.getByRole("button", { name: "Remover serviço 1" }).click();
  await expect(services.getByLabel("Nome")).toHaveValue("Bolos");
  // A reload brings the same answers back.
  await page.reload();
  await expect(card(page, "Serviços").getByLabel("Nome")).toHaveValue("Bolos");
});

test("testimonials appear only once a real one is written", async ({ page }) => {
  const testimonials = card(page, "Depoimentos");
  await expect(testimonials).toContainText("Só opiniões reais");
  await testimonials.getByLabel("O que a pessoa disse").fill("O melhor pão da cidade.");

  await showPreview(page);
  await expect(site(page).locator("#hero-title")).toBeVisible({ timeout: 15_000 });
  await expect(site(page).locator("#depoimentos")).toHaveCount(0);
  if (isMobile(page)) await page.getByRole("button", { name: "Fechar prévia" }).click();

  await testimonials.getByLabel("Nome").fill("Maria S.");
  await showPreview(page);
  await expect(site(page).locator("#depoimentos")).toContainText("O melhor pão da cidade.", {
    timeout: 15_000,
  });
  if (isMobile(page)) await page.getByRole("button", { name: "Fechar prévia" }).click();

  // Question 4 now lets the client switch the section.
  await page.goto("/criar/secoes");
  const toggle = page.getByRole("switch", { name: "Depoimentos" });
  await expect(toggle).toBeEnabled();
  await expect(toggle).toBeChecked();
});

test("a button that opens another site needs a real address", async ({ page }) => {
  const hero = card(page, "Topo");
  await hero.getByText("Outro site", { exact: true }).click();
  const address = hero.getByLabel("Endereço do site");
  await address.fill("instagram.com/padariadoze");
  await expect(hero.getByText("Use um endereço que comece com http:// ou https://.")).toBeVisible();
  await address.fill("https://instagram.com/padariadoze");
  await expect(hero.getByText("Use um endereço que comece com http:// ou https://.")).toBeHidden();
  await hero.getByLabel("Texto do botão").fill("Veja nosso Instagram");

  await showPreview(page);
  const button = site(page).getByRole("link", { name: "Veja nosso Instagram" }).first();
  await expect(button).toHaveAttribute("href", "https://instagram.com/padariadoze", {
    timeout: 15_000,
  });
});
