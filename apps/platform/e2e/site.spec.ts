import { formSteps } from "@brotasites/schema";
import { expect, type Page, test } from "@playwright/test";

// The public site: home with the stem, help, terms and privacy.

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const pages = ["/", "/ajuda", "/termos", "/privacidade"];

test("the home page presents the seven questions in the form's order", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Sete perguntas e seu site pronto.",
  );
  const questions = page
    .getByRole("list", { name: "As sete perguntas" })
    .getByRole("heading", { level: 3 });
  await expect(questions).toHaveText(formSteps.map((step) => step.question));

  await page.getByRole("main").getByRole("link", { name: "Criar meu site" }).first().click();
  await expect(page).toHaveURL(/\/criar\/negocio$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qual é o seu negócio?");
});

test("with reduced motion the stem is shown fully grown", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  const ink = page.locator(".stem-ink");
  await expect(ink).toHaveCSS("transform", "none");
  await expect(page.locator(".stem-leaf").last()).toHaveCSS("opacity", "1");
  await context.close();
});

test("every page has one title, the landmarks and no sideways scroll", async ({ page }) => {
  test.setTimeout(60_000);
  for (const path of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }), path).toHaveCount(1);
    await expect(page.getByRole("banner"), path).toBeVisible();
    await expect(page.getByRole("main"), path).toBeVisible();
    await expect(page.getByRole("contentinfo"), path).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBe(0);
  }
});

test("the header and footer lead to every page", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  for (const [name, path] of [
    ["Termos de uso", "/termos"],
    ["Privacidade", "/privacidade"],
    ["Ajuda", "/ajuda"],
  ] as const) {
    await footer.getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
  if (!isPhone(page)) {
    await page.getByRole("banner").getByRole("link", { name: "Como funciona" }).click();
    await expect(page).toHaveURL(/\/#como-funciona$/);
  }
});

test("the phone menu works with the keyboard", async ({ page }) => {
  test.skip(!isPhone(page), "The menu exists only on phones");
  await page.goto("/");
  const open = page.getByRole("button", { name: "Abrir menu" });
  await open.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  // Focus stays inside while it is open.
  for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
  expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(open).toBeFocused();

  await open.click();
  await menu.getByRole("link", { name: "Ajuda" }).click();
  await expect(page).toHaveURL(/\/ajuda$/);
  await expect(menu).toBeHidden();
});

test("help answers open from a direct link and the contents lead to each part", async ({
  page,
}) => {
  await page.goto("/ajuda#quanto-custa");
  const question = page.getByRole("button", { name: "Quanto custa?" });
  await expect(question).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("region", { name: "Quanto custa?" })).toBeVisible();

  const contents = page.getByRole("navigation", { name: "Nesta página" });
  if (isPhone(page)) await contents.locator("summary").click();
  await contents.getByRole("link", { name: "Seus dados e informações" }).click();
  await expect(page.getByRole("heading", { name: "Seus dados e informações" })).toBeInViewport();
});

test("terms and privacy say they are under review", async ({ page }) => {
  for (const path of ["/termos", "/privacidade"]) {
    await page.goto(path);
    await expect(page.getByRole("note")).toHaveText(/Versão inicial, em revisão jurídica/);
  }
});

test("search engines get the sitemap and the public pages only", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/ajuda", "/termos", "/privacidade"]) expect(sitemap).toContain(path);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /criar");
});

test("the site has a favicon, app icons and a manifest", async ({ page, request }) => {
  for (const path of ["/favicon.ico", "/icon.png", "/apple-icon.png", "/manifest.webmanifest"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  await page.goto("/");
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /icon|favicon/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
});

test("questions are headings with buttons that open by keyboard", async ({ page }) => {
  await page.goto("/");
  const question = page
    .getByRole("heading", { level: 3, name: "Quanto custa?" })
    .getByRole("button");
  await expect(question).toHaveAttribute("aria-expanded", "false");
  const panel = page.locator(`[id="${await question.getAttribute("aria-controls")}"]`);
  await expect(panel).toBeHidden();

  await question.focus();
  await page.keyboard.press("Enter");
  await expect(question).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await expect(question).toHaveCSS("outline-style", "solid");

  await page.keyboard.press("Space");
  await expect(question).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
});

test("the vine decoration stays out of the content", async ({ page }) => {
  await page.goto("/");
  const vine = page.getByTestId("site-vine");
  const width = page.viewportSize()?.width ?? 0;
  if (width < 1280) {
    // Narrow screens have no side margins, so there is no vine at all.
    await expect(vine).toHaveCount(0);
    return;
  }
  // Wide screens: only the margins outside the 72rem content column show it.
  await expect(vine).toHaveCSS("pointer-events", "none");
  await expect(vine).toHaveAttribute("aria-hidden", "true");
  await expect(vine).toHaveCSS("mask-image", /transparent calc\(50% - 36rem\)/);
});
