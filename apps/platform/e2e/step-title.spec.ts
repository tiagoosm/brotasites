import { expect, type Page, test } from "@playwright/test";
import { SITE, withSite } from "./support/supabase";

// The question title is never hidden behind the sticky header on phones: on load, after
// moving to the next question from a scrolled page, and with the virtual keyboard open.

test.skip(({ isMobile }) => !isMobile, "The sticky header only exists on small screens");

async function titleBelowHeader(page: Page) {
  return page.evaluate(() => {
    const title = document.querySelector("h1")?.getBoundingClientRect();
    const header = document.querySelector("main header")?.getBoundingClientRect();
    return Boolean(title && header && title.top >= header.bottom && title.bottom <= innerHeight);
  });
}

for (const width of [375, 360]) {
  test(`at ${width}px the next question opens with its title in view and focused`, async ({
    page,
    context,
  }) => {
    await withSite(context);
    await page.setViewportSize({ width, height: 700 });
    await page.goto(`/criar/${SITE}/negocio`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.poll(() => titleBelowHeader(page)).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();

    await page.getByLabel("Nome do negócio").fill("Padaria do Zé");
    await page.getByLabel("Tipo de negócio").fill("padar");
    await page.getByText("Padaria", { exact: true }).click();
    await page.getByLabel("Cidade", { exact: true }).fill("Santa Rita do Sapucaí");
    await page.getByLabel("Estado").selectOption("MG");
    // Fill the long fields below the fold, so the page is scrolled when moving on.
    await page.getByLabel("O que é mais pedido?").fill("Pão de queijo");
    await page.getByRole("button", { name: "Próximo: marca e sensação" }).click();

    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveText("Como você quer que o seu negócio pareça?");
    await expect(title).toBeFocused();
    await expect.poll(() => titleBelowHeader(page)).toBe(true);
  });
}

test("with the keyboard open, a focused field is not covered by the header", async ({
  page,
  context,
}) => {
  await withSite(context);
  // The virtual keyboard leaves a short screen; the browser scrolls the field into view.
  await page.setViewportSize({ width: 375, height: 380 });
  await page.goto(`/criar/${SITE}/negocio`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const city = page.getByLabel("Cidade", { exact: true });
  await city.focus();
  const covered = await page.evaluate(() => {
    const field = document.activeElement?.getBoundingClientRect();
    const header = document.querySelector("main header")?.getBoundingClientRect();
    return !field || !header || field.top < header.bottom;
  });
  expect(covered).toBe(false);
});
