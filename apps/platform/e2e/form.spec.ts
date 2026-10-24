import { expect, type Page, test } from "@playwright/test";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

/** Clicks a business type tag, as a person would (the radio input inside is visually hidden). */
async function chooseType(page: Page, name: string) {
  await page
    .getByRole("group", { name: "Tipo de negócio" })
    .getByText(name, { exact: true })
    .click();
  await expect(page.getByRole("radio", { name })).toBeChecked();
}

async function fillBusiness(page: Page) {
  await page.getByLabel("Nome do negócio").fill("Padaria do Zé");
  await chooseType(page, "Padaria");
  await page.getByLabel("Cidade").fill("Santa Rita do Sapucaí");
}

test("explains what is missing, in Portuguese", async ({ page }) => {
  await page.goto("/criar/negocio");
  await page.getByRole("button", { name: "Próximo: modelo" }).click();
  await expect(page.getByText("Escreva o nome do negócio, com pelo menos 2 letras.")).toBeVisible();
  await expect(page.getByText("Escolha um tipo da lista ou escreva qual é.")).toBeVisible();
  await expect(page.getByText("Escreva a cidade onde o negócio fica.")).toBeVisible();
  await expect(page).toHaveURL(/\/criar\/negocio$/);
});

test("answering the first question moves on and grows the stem", async ({ page }) => {
  await page.goto("/criar/negocio");
  await fillBusiness(page);
  await page.getByRole("button", { name: "Próximo: modelo" }).click();
  await expect(page).toHaveURL(/\/criar\/modelo$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qual estilo combina com você?");
  if (!isMobile(page)) {
    const rail = page.getByRole("navigation", { name: "Perguntas do formulário" });
    await expect(rail.locator('[aria-current="step"]')).toContainText("Modelo");
    await expect(rail.getByRole("link", { name: /Seu negócio/ })).toBeVisible();
  }
});

test("the draft survives a reload", async ({ page }) => {
  await page.goto("/criar/negocio");
  await fillBusiness(page);
  await expect(page.getByRole("status").first()).toContainText(/salvo/i, { timeout: 5_000 });
  await page.reload();
  await expect(page.getByLabel("Nome do negócio")).toHaveValue("Padaria do Zé");
  await expect(page.getByRole("radio", { name: "Padaria" })).toBeChecked();
  await expect(page.getByLabel("Cidade")).toHaveValue("Santa Rita do Sapucaí");
});

test("questions ahead of the client's progress send them back", async ({ page }) => {
  await page.goto("/criar/secoes");
  await expect(page).toHaveURL(/\/criar\/negocio$/);
});

test("a business type outside the list can be typed", async ({ page }) => {
  await page.goto("/criar/negocio");
  await page.getByLabel("Nome do negócio").fill("Flor de Lis");
  await chooseType(page, "Outro tipo");
  await page.getByLabel("Qual é o tipo do negócio?").fill("Floricultura");
  await page.getByLabel("Cidade").fill("Pouso Alegre");
  await page.getByRole("button", { name: "Próximo: modelo" }).click();
  await expect(page).toHaveURL(/\/criar\/modelo$/);
});

/** The visible preview iframe (two are kept; the hidden one loads the next update). */
const site = (page: Page) => page.frameLocator('iframe[data-active="true"]');

async function openPreview(page: Page) {
  if (isMobile(page)) await page.getByRole("button", { name: "Ver prévia" }).click();
  return isMobile(page)
    ? page.getByRole("dialog", { name: "Prévia do site" })
    : page.getByRole("region", { name: "Prévia do site" });
}

test("the preview renders the real template and follows typing", async ({ page }) => {
  await page.goto("/criar/negocio");
  await page.getByLabel("Nome do negócio").fill("Barbearia do Léo");
  await chooseType(page, "Barbearia");
  const preview = await openPreview(page);
  await expect(preview).toContainText("barbearia-do-leo.brotasites.com");
  // The template's own markup: hero title and the sections suggested for a barbershop.
  await expect(site(page).locator("#hero-title")).toHaveText(/Barbearia\s+do\s+Léo/);
  await expect(site(page).locator("#servicos")).toBeVisible();

  if (isMobile(page)) {
    await page.keyboard.press("Escape");
    await expect(preview).toBeHidden();
    await page.getByLabel("Nome do negócio").fill("Barbearia do Léo Centro");
    await openPreview(page);
  } else {
    await page.getByLabel("Nome do negócio").fill("Barbearia do Léo Centro");
  }
  await expect(site(page).locator("#hero-title")).toHaveText(/Barbearia\s+do\s+Léo\s+Centro/);
});

test("the preview switches between phone and computer", async ({ page }) => {
  test.skip(isMobile(page), "On phones the preview opens at phone size");
  await page.goto("/criar/negocio");
  const preview = await openPreview(page);
  await expect(site(page).locator("#hero-title")).toBeVisible();
  await preview.getByRole("button", { name: "celular" }).click();
  await expect(preview.getByRole("button", { name: "celular" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('iframe[data-active="true"]')).toHaveCSS("width", "390px");
  // At phone width the template shows its mobile menu button.
  await expect(site(page).getByLabel("Abrir menu")).toBeVisible();
});

test("does not scroll sideways and logs no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.goto("/criar/negocio");
  await fillBusiness(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});

test("an answer typed right before leaving the page is kept", async ({ page }) => {
  await page.goto("/criar/negocio");
  await page.getByLabel("Nome do negócio").fill("Empório Serra");
  // Reload immediately, before the debounced save would run.
  await page.reload();
  await expect(page.getByLabel("Nome do negócio")).toHaveValue("Empório Serra");
});
