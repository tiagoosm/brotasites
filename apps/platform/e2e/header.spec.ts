import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { SITE, SUPABASE, signIn } from "./support/supabase";

// The one header of every page (E17): the same four links, "Entrar ou cadastre-se" and "Criar meu site"
// signed out, the profile menu signed in, decided on the server (no flicker).

const middle = ["Como funciona", "Preço", "Dúvidas", "Ajuda"];
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) <= 768;

const person = (name = "Zé da Padaria") => {
  const id = randomUUID();
  return { id, email: `cabecalho-${id.slice(0, 8)}@padariadoze.com.br`, name };
};

async function signedIn(
  context: BrowserContext,
  request: APIRequestContext,
  who: ReturnType<typeof person>,
  options: { team?: boolean } = {},
) {
  await request.post(`${SUPABASE}/__test/dashboard`, {
    data: { userId: who.id, fullName: who.name },
  });
  if (options.team) await request.post(`${SUPABASE}/__test/team`, { data: { userId: who.id } });
  await signIn(context, { user: who });
}

const banner = (page: Page) => page.getByRole("banner");
const profileButton = (page: Page) => banner(page).getByRole("button", { name: /^Menu da conta/ });

test.describe("the same header everywhere", () => {
  const visitorPages = ["/", "/ajuda", "/termos", "/privacidade", "/entrar", "/cadastro"];
  for (const path of visitorPages) {
    test(`signed out on ${path}`, async ({ page }) => {
      test.skip(isPhone(page), "The middle links live in the phone menu");
      await page.goto(path);
      const nav = banner(page).getByRole("navigation", { name: "Principal" });
      await expect(nav.getByRole("link")).toHaveText(middle);
      await expect(nav.getByRole("link", { name: "Preço" })).toHaveAttribute("href", "/#preco");
      // One way in (E18), to /entrar, where signing up is one tap away.
      await expect(
        banner(page).getByRole("link", { name: "Entrar ou cadastre-se" }),
      ).toHaveAttribute("href", "/entrar");
      await expect(banner(page).getByRole("link", { name: "Criar conta" })).toHaveCount(0);
      // The home page's hero has the main button; every other page has it in the header.
      await expect(banner(page).getByRole("link", { name: "Criar meu site" })).toHaveCount(
        path === "/" ? 0 : 1,
      );
      await expect(profileButton(page)).toHaveCount(0);
      if (path === "/ajuda") {
        await expect(nav.getByRole("link", { name: "Ajuda" })).toHaveAttribute(
          "aria-current",
          "page",
        );
      }
      await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toHaveCount(1);
    });
  }

  const memberPages = [
    "/",
    "/ajuda",
    "/painel",
    "/conta",
    `/meus-sites/${SITE}`,
    `/criar/${SITE}/negocio`,
    "/admin",
  ];
  for (const path of memberPages) {
    test(`signed in on ${path}`, async ({ page, context, request }) => {
      test.skip(isPhone(page), "The middle links live in the phone menu");
      await signedIn(context, request, person());
      await page.goto(path);
      const nav = banner(page).getByRole("navigation", { name: "Principal" });
      await expect(nav.getByRole("link")).toHaveText(middle);
      await expect(profileButton(page)).toBeVisible();
      await expect(
        banner(page).getByRole("link", { name: "Criar site", exact: true }),
      ).toBeVisible();
      // No account links loose in the bar: they are in the profile menu.
      for (const name of [
        "Painel",
        "Perfil e segurança",
        "Conta",
        "Entrar ou cadastre-se",
        "Sair",
      ]) {
        await expect(
          banner(page).getByRole("link", { name, exact: true }).filter({ visible: true }),
        ).toHaveCount(0);
      }
      await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toHaveCount(1);
    });
  }
});

test("the first answer already has the right header (no flicker)", async ({ context, request }) => {
  const visitor = await request.get("/");
  expect(await visitor.text()).not.toContain('aria-haspopup="menu"');
  const who = person("Ágata Érica");
  await signedIn(context, request, who);
  // Public pages: the signed-in variant, prerendered with the profile button.
  expect(await (await context.request.get("/ajuda")).text()).toContain('aria-haspopup="menu"');
  // Signed-in pages: the initials, read on the server.
  const panel = await (await context.request.get("/painel")).text();
  expect(panel).toContain('aria-haspopup="menu"');
  expect(panel).toContain(">ÁÉ<");
});

test("the profile menu works with the keyboard", async ({ page, context, request }) => {
  await signedIn(context, request, person());
  await page.goto("/painel");
  const button = profileButton(page);
  await expect(button).toHaveText("ZP");
  await expect(button).toHaveAttribute("aria-haspopup", "menu");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  const items = page.getByRole("menuitem");

  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByText("Zé da Padaria", { exact: true })).toBeVisible();
  await expect(items).toHaveText(["Painel", "Criar site", "Perfil e segurança", "Sair"]);
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(items.last()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(items.last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(button).toBeFocused();

  // Space opens it too; Tab closes it.
  await page.keyboard.press(" ");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("menu")).toBeHidden();

  // A click outside closes it.
  await button.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.mouse.click(5, 300);
  await expect(page.getByRole("menu")).toBeHidden();

  // An item leads to its page.
  await button.click();
  await items.filter({ hasText: "Perfil e segurança" }).click();
  await expect(page).toHaveURL(/\/conta$/);
});

test("the team sees Área da equipe, others do not", async ({ page, context, request }) => {
  await signedIn(context, request, person(), { team: true });
  await page.goto("/painel");
  await profileButton(page).click();
  await expect(page.getByRole("menuitem", { name: "Área da equipe" })).toHaveAttribute(
    "href",
    "/admin",
  );
  // On a prerendered public page the menu asks the server when it opens.
  await page.goto("/ajuda");
  await profileButton(page).click();
  await expect(page.getByRole("menuitem", { name: "Área da equipe" })).toBeVisible();
  await expect(page.getByText("Zé da Padaria", { exact: true })).toBeVisible();

  await context.clearCookies();
  const other = person("Beto");
  await signedIn(context, request, other);
  await page.goto("/painel");
  await profileButton(page).click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Painel",
    "Criar site",
    "Perfil e segurança",
    "Sair",
  ]);
});

test("signing out from the menu goes back to the visitor's header", async ({
  page,
  context,
  request,
}) => {
  await signedIn(context, request, person());
  await page.goto("/painel");
  await profileButton(page).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(profileButton(page)).toHaveCount(0);
  if (!isPhone(page))
    await expect(banner(page).getByRole("link", { name: "Entrar ou cadastre-se" })).toBeVisible();
});

test("on phones the sheet lists the links and the account", async ({ page, context, request }) => {
  test.skip(!isPhone(page), "The sheet exists only on phones");
  await signedIn(context, request, person(), { team: true });
  await page.goto("/painel");
  await expect(profileButton(page)).toBeVisible();
  await banner(page).getByRole("button", { name: "Abrir menu" }).click();
  const sheet = page.getByRole("dialog", { name: "Menu" });
  // The account block, then "Criar site" as the sheet's main button (E18).
  await expect(sheet.getByRole("link")).toHaveText([
    ...middle,
    "Painel",
    "Perfil e segurança",
    "Área da equipe",
    "Criar site",
  ]);
  await expect(sheet.locator("a[data-create-site]")).toHaveClass(/specular/);
  await expect(sheet.getByText("Sua conta")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Sair" })).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("the home page has no demo and no example; /exemplo is gone", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByText(/Experimente aqui/i)).toHaveCount(0);
  await expect(page.getByText(/Veja um site de verdade/i)).toHaveCount(0);
  await expect(page.locator('a[href^="/exemplo"]')).toHaveCount(0);
  // The first button shows without scrolling, also on a 360px phone.
  await page.setViewportSize({ width: 360, height: 640 });
  await page.reload();
  await expect(
    page.getByRole("main").getByRole("link", { name: "Criar meu site" }).first(),
  ).toBeInViewport({
    ratio: 1,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  for (const path of ["/exemplo", "/exemplo-site/", "/exemplo-site/index.html"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test("the header passes axe with the profile menu open, without sideways scroll", async ({
  page,
  context,
  request,
}) => {
  await signedIn(context, request, person());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto("/painel");
  await profileButton(page).click();
  await expect(page.getByRole("menu")).toBeVisible();
  const result = await new AxeBuilder({ page })
    .include("header")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).join(" | ")}`),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  for (const item of await page.getByRole("menuitem").all()) {
    expect((await item.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  const box = await profileButton(page).boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
});
