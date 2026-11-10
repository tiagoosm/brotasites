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

// The one header of every page (E17): the same three links (E29: "Dúvidas" left); signed out
// "Entrar" and "Criar conta" (E30), never the page the person is on
// (E26: never "Criar meu site" for visitors), "Criar meu site" and the profile menu signed in,
// decided on the server (no flicker).

const middle = ["Como funciona", "Preço", "Ajuda"];
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
  const visitorPages = ["/", "/ajuda", "/termos", "/privacidade"];
  for (const path of visitorPages) {
    test(`signed out on ${path}`, async ({ page }) => {
      test.skip(isPhone(page), "The middle links live in the phone menu");
      await page.goto(path);
      const nav = banner(page).getByRole("navigation", { name: "Principal" });
      await expect(nav.getByRole("link")).toHaveText(middle);
      await expect(nav.getByRole("link", { name: "Preço" })).toHaveAttribute("href", "/#preco");
      // Two ways in (E30): "Entrar" (quiet) and "Criar conta" (the highlight), each 44px tall.
      const signIn = banner(page).getByRole("link", { name: "Entrar", exact: true });
      const signUp = banner(page).getByRole("link", { name: "Criar conta" });
      await expect(signIn).toHaveAttribute("href", "/entrar");
      await expect(signUp).toHaveAttribute("href", "/cadastro");
      await expect(signUp).toHaveClass(/specular/);
      await expect(signIn).not.toHaveClass(/specular/);
      for (const way of [signIn, signUp]) {
        expect(
          await way.evaluate((link) => {
            const box = link.getBoundingClientRect();
            const x = box.left + box.width / 2;
            const y = box.top + box.height / 2;
            return [y - 21, y + 21].every((at) => link.contains(document.elementFromPoint(x, at)));
          }),
        ).toBe(true);
      }
      const [a, b] = [await signIn.boundingBox(), await signUp.boundingBox()];
      expect(a?.height).toBe(b?.height);
      // "Entrar" first, then "Criar conta", 8 to 12px apart.
      const gap = (b?.x ?? 0) - ((a?.x ?? 0) + (a?.width ?? 0));
      expect(gap).toBeGreaterThanOrEqual(8);
      expect(gap).toBeLessThanOrEqual(12);
      // A visitor never sees "Criar meu site" in the header (E26): it only led to signing in.
      await expect(banner(page).getByRole("link", { name: "Criar meu site" })).toHaveCount(0);
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

  // E30: never the page the person is on, none on the password screens (E29's rule).
  const onScreens: [string, string[]][] = [
    ["/entrar", ["Criar conta"]],
    ["/cadastro", ["Entrar"]],
    ["/esqueci-senha", []],
    ["/redefinir-senha", []],
  ];
  for (const [path, offered] of onScreens) {
    test(`on ${path} the visitor is offered ${offered.join(" and ") || "neither button"}`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(banner(page).getByRole("link", { name: "BrotaSites" }).first()).toBeVisible();
      let scope = banner(page);
      if (isPhone(page)) {
        const button = banner(page).getByRole("button", { name: "Abrir menu" });
        const sheet = page.getByRole("dialog", { name: "Menu" });
        await expect(async () => {
          await button.click();
          await expect(sheet).toBeVisible({ timeout: 1000 });
        }).toPass();
        await expect(sheet.getByRole("link", { name: "Ajuda" })).toBeVisible();
        scope = sheet;
      } else {
        const nav = banner(page).getByRole("navigation", { name: "Principal" });
        await expect(nav.getByRole("link")).toHaveText(middle);
      }
      for (const name of ["Entrar", "Criar conta"]) {
        await expect(scope.getByRole("link", { name, exact: true })).toHaveCount(
          offered.includes(name) ? 1 : 0,
        );
      }
    });
  }

  const memberPages = [
    "/",
    "/ajuda",
    "/meus-sites",
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
      const create = banner(page).getByRole("link", { name: "Criar meu site", exact: true });
      await expect(create).toBeVisible();
      await expect(create).toHaveClass(/specular-nav/);
      // No account links loose in the bar: they are in the profile menu.
      for (const name of [
        "Meus sites",
        "Perfil e segurança",
        "Conta",
        "Entrar",
        "Criar conta",
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
  const panel = await (await context.request.get("/meus-sites")).text();
  expect(panel).toContain('aria-haspopup="menu"');
  expect(panel).toContain(">ÁÉ<");
});

test("the profile menu works with the keyboard", async ({ page, context, request }) => {
  await signedIn(context, request, person());
  await page.goto("/meus-sites");
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
  // On Meus sites, the menu leaves out Meus sites (E29: never the current page).
  await expect(items).toHaveText(["Criar meu site", "Perfil e segurança", "Sair"]);
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
  await page.goto("/meus-sites");
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
  await page.goto("/meus-sites");
  await profileButton(page).click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Criar meu site",
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
  await page.goto("/meus-sites");
  await profileButton(page).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(profileButton(page)).toHaveCount(0);
  if (!isPhone(page))
    await expect(banner(page).getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
});

test("on phones the sheet lists the links and the account", async ({ page, context, request }) => {
  test.skip(!isPhone(page), "The sheet exists only on phones");
  await signedIn(context, request, person(), { team: true });
  await page.goto("/meus-sites");
  await expect(profileButton(page)).toBeVisible();
  await banner(page).getByRole("button", { name: "Abrir menu" }).click();
  const sheet = page.getByRole("dialog", { name: "Menu" });
  // The account block, then "Criar meu site" as the sheet's main button (E18).
  // Never the page the person is on (E29): no "Meus sites" on Meus sites.
  await expect(sheet.getByRole("link")).toHaveText([
    ...middle,
    "Perfil e segurança",
    "Área da equipe",
    "Criar meu site",
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
  await page.goto("/meus-sites");
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

test("the middle links keep their place signed in, out and on every account screen (E30)", async ({
  page,
  context,
  request,
}, info) => {
  test.skip(info.project.name !== "desktop", "the sizes are set here");
  test.setTimeout(120_000);
  const widths = [768, 820, 1024, 1280, 1440];
  const places = async () =>
    banner(page)
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().left)));
  const seen = new Map<number, number[]>();
  const check = async (path: string) => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await expect(banner(page).getByRole("navigation", { name: "Principal" })).toBeVisible();
      const now = await places();
      const before = seen.get(width);
      if (before) expect(now, `${path} at ${width}px`).toEqual(before);
      else seen.set(width, now);
      // Nothing wider than the screen, nothing squeezed: the brand and the buttons keep one line.
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const tall = await banner(page)
        .locator("a")
        .evaluateAll(
          (links) => links.filter((link) => link.getBoundingClientRect().height > 50).length,
        );
      expect(tall, `${path} at ${width}px`).toBe(0);
    }
  };
  for (const path of ["/", "/entrar", "/cadastro", "/esqueci-senha"]) await check(path);
  await signedIn(context, request, person());
  await check("/");
});
