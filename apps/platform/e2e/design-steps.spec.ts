import { expect, type Page, test } from "@playwright/test";

// Questions 2 to 4: template, colors and fonts, sections. Each test starts with the first
// question already answered, the way a returning client would find their draft.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;
const site = (page: Page) => page.frameLocator('iframe[data-active="true"]');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("brotasites:rascunho:v1")) return;
    window.localStorage.setItem(
      "brotasites:rascunho:v1",
      JSON.stringify({
        draft: {},
        completed: ["negocio", "modelo", "cores"],
      }),
    );
  });
  // Answer question 1 through the real form, so presets are applied as they would be.
  await page.goto("/criar/negocio");
  await page.getByLabel("Nome do negócio").fill("Padaria do Zé");
  await page
    .getByRole("group", { name: "Tipo de negócio" })
    .getByText("Padaria", { exact: true })
    .click();
  await page.getByLabel("Cidade").fill("Santa Rita do Sapucaí");
  await expect(page.getByRole("status").first()).toContainText(/salvo/i);
});

async function showPreview(page: Page) {
  if (isMobile(page)) await page.getByRole("button", { name: "Ver prévia" }).click();
}

test("question 2 offers the available template and says which are coming", async ({ page }) => {
  await page.getByRole("button", { name: "Próximo: modelo" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qual estilo combina com você?");
  await expect(page.getByRole("radio", { name: /Clássico/ })).toBeChecked();
  for (const name of [/Moderno/, /Minimalista/, /Vibrante/]) {
    await expect(page.getByRole("radio", { name })).toBeDisabled();
  }
  await page.getByRole("button", { name: "Próximo: cores e fontes" }).click();
  await expect(page).toHaveURL(/\/criar\/cores$/);
});

test("question 3 changes palette and fonts in the preview", async ({ page }) => {
  await page.goto("/criar/cores");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Que cores e letras são a sua cara?",
  );
  // The bakery palettes come first.
  await expect(page.getByRole("radio", { name: "Forno" })).toBeChecked();

  await page.getByText(/Ver mais \d+ paletas/).click();
  await page.locator("label", { hasText: "Noite" }).click();
  await expect(page.getByRole("radio", { name: "Noite" })).toBeChecked();
  await page.locator("label", { hasText: "Firme" }).click();

  await showPreview(page);
  await expect(site(page).locator("body")).toHaveCSS("background-color", "rgb(20, 17, 15)", {
    timeout: 15_000,
  });
  await expect(site(page).locator("#hero-title")).toHaveCSS("font-family", /Roboto Slab/, {
    timeout: 15_000,
  });
});

test("question 3 warns when text would be hard to read", async ({ page }) => {
  await page.goto("/criar/cores");
  const warning = page.getByText("O texto pode ficar difícil de ler sobre esse fundo.", {
    exact: false,
  });
  await expect(warning).toBeHidden();
  await page.getByLabel("Texto · Cor das letras").fill("#FFF8E0");
  await expect(warning).toBeVisible();
  await expect(page.getByRole("radio", { name: "Forno" })).not.toBeChecked();
});

test("question 4 turns sections off and reorders them", async ({ page }) => {
  await page.goto("/criar/secoes");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "O que não pode faltar no seu site?",
  );
  await expect(page.getByText("Sempre aparece")).toBeVisible();
  // Testimonials need a real one first.
  await expect(page.getByRole("switch", { name: "Depoimentos" })).toBeDisabled();

  await page.getByRole("switch", { name: "Galeria de fotos" }).click();
  await expect(page.getByRole("switch", { name: "Galeria de fotos" })).not.toBeChecked();
  await page.getByRole("button", { name: "Subir Contato e mapa" }).click();
  await expect(page.getByRole("button", { name: "Subir Contato e mapa" })).toBeFocused();

  const order = await page
    .getByRole("list", { name: "Partes do site, na ordem em que aparecem" })
    .getByRole("listitem")
    .evaluateAll((items) => items.map((li) => li.querySelector("label")?.textContent?.trim()));
  expect(order.slice(-2)).toEqual(["Contato e mapa", "Chamada final"]);

  await showPreview(page);
  // The preview swaps frames as it updates, so read it until it settles on the new order.
  await expect
    .poll(
      () =>
        site(page)
          .locator("main > section[id]")
          .evaluateAll((sections) => sections.map((s) => s.id))
          .catch(() => []),
      { timeout: 10_000 },
    )
    .toEqual(["hero", "sobre", "servicos", "faq", "contato", "cta-final"]);
});

test("no question scrolls sideways on any screen", async ({ page }) => {
  test.setTimeout(60_000);
  for (const slug of ["negocio", "modelo", "cores", "secoes"]) {
    await page.goto(`/criar/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, slug).toBe(0);
  }
});
