import { expect, type Page, test } from "@playwright/test";

// The phone menu (site-header.tsx), up to 768px: keyboard and screen reader use, an inert
// page behind it that does not scroll, and links that close it.

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const items = ["Como funciona", "Preço", "Dúvidas", "Ajuda", "Entrar", "Criar meu site"];

async function openMenu(page: Page) {
  const button = page.getByRole("button", { name: "Abrir menu" });
  const menu = page.getByRole("dialog", { name: "Menu" });
  // The button only responds once the page's script has loaded; retry until it does.
  await expect(async () => {
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible({ timeout: 1000 });
  }).toPass();
  return { button, menu };
}

test("the menu button says what it does and which panel it opens", async ({ page }) => {
  test.skip(!isPhone(page), "The menu exists only on phones");
  await page.goto("/");
  const button = page.getByRole("button", { name: "Abrir menu" });
  await expect(button).toHaveAttribute("aria-controls", "menu-celular");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  const { menu } = await openMenu(page);
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(menu).toHaveAttribute("id", "menu-celular");
  await expect(menu).toHaveAttribute("aria-modal", "true");
  await expect(menu.getByRole("button", { name: "Fechar menu" })).toBeFocused();
});

test("the open menu covers the whole screen, down to its last button", async ({ page }) => {
  test.skip(!isPhone(page), "The menu exists only on phones");
  await page.goto("/");
  const { menu } = await openMenu(page);
  const box = await menu.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.y).toBe(0);
  expect(box?.height).toBe(viewport?.height);
  await expect(menu.getByRole("link", { name: "Criar meu site" })).toBeInViewport({ ratio: 1 });
});

test("it lists every part, then the main button, each easy to tap", async ({ page }) => {
  test.skip(!isPhone(page), "The menu exists only on phones");
  await page.goto("/");
  const { menu } = await openMenu(page);
  await expect(menu.getByRole("link")).toHaveText(items);
  for (const link of await menu.getByRole("link").all()) {
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("focus stays inside, Escape closes it and focus goes back to the button", async ({ page }) => {
  test.skip(!isPhone(page), "The menu exists only on phones");
  test.setTimeout(60_000);
  await page.goto("/");
  const { button, menu } = await openMenu(page);
  const inside = () => menu.evaluate((el) => el.contains(document.activeElement));
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    expect(await inside()).toBe(true);
  }
  // Shift+Tab from the first control goes round to the last.
  await menu.getByRole("button", { name: "Fechar menu" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(menu.getByRole("link", { name: "Criar meu site" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute("aria-expanded", "false");
});

test("while open the page behind is inert and does not scroll", async ({ page }) => {
  test.skip(!isPhone(page), "The menu exists only on phones");
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, 300));
  const { menu } = await openMenu(page);
  await expect(page.locator("main")).toHaveJSProperty("inert", true);
  await expect(page.locator("footer")).toHaveJSProperty("inert", true);

  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(180, 400);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  // Tapped where it is: a locator click would first scroll it into view, which a real finger
  // never does.
  const close = await menu.getByRole("button", { name: "Fechar menu" }).boundingBox();
  if (!close) throw new Error("no close button");
  await page.touchscreen.tap(close.x + close.width / 2, close.y + close.height / 2);
  await expect(menu).toBeHidden();
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test("a link closes the menu and leads to its part", async ({ page }) => {
  test.skip(!isPhone(page), "The menu exists only on phones");
  await page.goto("/");
  const { menu } = await openMenu(page);
  await menu.getByRole("link", { name: "Preço" }).click();
  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/\/#preco$/);
  await expect(page.getByRole("heading", { name: "Quanto custa", exact: true })).toBeInViewport();
});

test("with reduced motion the menu appears at once", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/");
  const { menu } = await openMenu(page);
  expect(await menu.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await context.close();
});

test("on wide screens the header keeps its links and has no menu button", async ({ page }) => {
  test.skip(isPhone(page), "Phones get the menu");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Abrir menu" })).toBeHidden();
  await expect(page.getByRole("banner").getByRole("link", { name: "Como funciona" })).toBeVisible();
});
