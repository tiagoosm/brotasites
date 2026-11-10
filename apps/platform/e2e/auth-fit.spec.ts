import { expect, test } from "@playwright/test";

// The account pages fit (E26; no footer since E30): on laptops and larger the header and the
// card fit with no scroll; on short screens and phones the card is never cut and the page
// scrolls to its end. The sign-up card keeps its full breathing room (owner, E27). The morning
// light stays visible around the card, behind it. No account screen has a footer (E30).

const pages = ["/entrar", "/cadastro", "/esqueci-senha", "/redefinir-senha"];
const compact = pages.filter((path) => path !== "/cadastro");
const laptops: [number, number][] = [
  [1366, 650],
  [1280, 600],
];
const others: [number, number][] = [
  [1024, 768],
  [768, 1024],
  [390, 844],
  [360, 640],
];

// biome-ignore lint/correctness/noEmptyPattern: Playwright reads the fixtures from this pattern
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "each test sets its own screen sizes");
});

test("/cadastro fits a short laptop with no scroll, 24px under the header", async ({ page }) => {
  for (const [width, height] of laptops) {
    await page.setViewportSize({ width, height });
    await page.goto("/cadastro");
    await expect(page.locator(".skeleton-screen")).toHaveCount(0);
    const card = page.locator("[data-auth-card]");
    await expect(card).toBeVisible();
    const button = await page
      .getByRole("button", { name: "Criar conta" })
      .evaluate((element) => element.getBoundingClientRect().bottom);
    expect(button, `${width}×${height}`).toBeLessThanOrEqual(height);
    const scroll = await page.evaluate(() => document.scrollingElement?.scrollHeight ?? 0);
    expect(scroll, `${width}×${height}: no scroll`).toBeLessThanOrEqual(height);
    // Fields stay full tap targets: 44px on short laptops (E30, to fit with no scroll).
    const field = await page
      .getByLabel("Seu nome")
      .evaluate((input) => Math.round(input.getBoundingClientRect().height));
    expect(field).toBeGreaterThanOrEqual(44);
    const top = await card.evaluate((element) => element.getBoundingClientRect().top);
    // E30: at least 24px under the header.
    expect(top - 65, `${width}×${height}`).toBeGreaterThanOrEqual(24);
    // Never cut: the page scrolls to the card's end.
    await page.evaluate(() => window.scrollTo(0, document.scrollingElement?.scrollHeight ?? 0));
    const bottom = await card.evaluate((element) => element.getBoundingClientRect().bottom);
    expect(bottom, `${width}×${height}`).toBeLessThanOrEqual(height);
  }
});

for (const path of compact) {
  test(`${path} fits a laptop screen`, async ({ page }) => {
    for (const [width, height] of laptops) {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      // A first load streams the page's skeleton first (loading.tsx); measure the page.
      await expect(page.locator(".skeleton-screen")).toHaveCount(0);
      await expect(page.locator("[data-auth-card]")).toBeVisible();
      const { scroll, screen, card } = await page.evaluate(() => ({
        scroll: document.scrollingElement?.scrollHeight ?? 0,
        screen: window.innerHeight,
        card: document.querySelector("[data-auth-card]")?.getBoundingClientRect().bottom ?? 0,
      }));
      // The whole card in view, and no scroll at all now that there is no footer (E30).
      expect(card, `${width}×${height}`).toBeLessThanOrEqual(screen);
      expect(scroll, `${width}×${height}`).toBeLessThanOrEqual(screen);
    }
  });
}

for (const path of pages) {
  test(`${path} has no footer (E30)`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("[data-auth-card]")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
  });

  test(`${path} is never cut on smaller screens`, async ({ page }) => {
    for (const [width, height] of others) {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await expect(page.locator(".skeleton-screen")).toHaveCount(0);
      const card = page.locator("[data-auth-card]");
      await expect(card).toBeVisible();
      // Nothing of the page hides overflow: only the light's own layer does.
      expect(await page.locator("main").evaluate((main) => getComputedStyle(main).overflow)).toBe(
        "visible",
      );
      await page.evaluate(() => window.scrollTo(0, document.scrollingElement?.scrollHeight ?? 0));
      const bottom = await card.evaluate((element) => element.getBoundingClientRect().bottom);
      expect(bottom, `${width}×${height}`).toBeLessThanOrEqual(height);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  });
}

test("without WebGL or with reduced motion, a static light shows around the card", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  for (const path of ["/entrar", "/cadastro"]) {
    await page.goto(path);
    const glow = page.locator("[data-morning-light] .morning-glow");
    await expect(glow).toHaveCount(1);
    expect(await glow.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain(
      "gradient",
    );
    await expect(glow).toHaveCSS("opacity", "1");
    // The same look as with WebGL (E27): a halo behind the card, the corner's glow and broad,
    // blurred beams, all static.
    expect(await glow.evaluate((element) => getComputedStyle(element).backgroundImage)).toMatch(
      /radial-gradient.*radial-gradient.*radial-gradient/,
    );
    const beams = page.locator("[data-morning-light] .morning-beams");
    expect(await beams.evaluate((element) => getComputedStyle(element).filter)).toContain("blur");
    // No hard line under the header: the layer starts behind it and fades in.
    const layer = page.locator("[data-morning-light]");
    const [layerTop, headerBottom] = await Promise.all([
      layer.evaluate((element) => element.getBoundingClientRect().top),
      page
        .locator("header")
        .first()
        .evaluate((element) => element.getBoundingClientRect().bottom),
    ]);
    expect(layerTop).toBeLessThan(headerBottom);
    expect(await layer.evaluate((element) => getComputedStyle(element).maskImage)).toContain(
      "linear-gradient",
    );
    // Nothing moves: no beams canvas at all.
    await expect(page.locator("[data-morning-light] canvas")).toHaveCount(0);
  }
  await context.close();
});

test("sign-up: the button spans the card and the terms keep to one line (E30)", async ({
  page,
}) => {
  for (const [width, height] of [
    [1366, 650],
    [360, 640],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/cadastro");
    await expect(page.locator(".skeleton-screen")).toHaveCount(0);
    const form = await page.locator("[data-auth-card] form").boundingBox();
    const button = await page.getByRole("button", { name: "Criar conta" }).boundingBox();
    expect(Math.abs((button?.width ?? 0) - (form?.width ?? 0))).toBeLessThanOrEqual(1);
    const lines = await page
      .locator('label[for="cadastro-termos"]')
      .evaluate((label) =>
        Math.round(
          label.getBoundingClientRect().height / parseFloat(getComputedStyle(label).lineHeight),
        ),
      );
    // One line on the laptop; on a phone it wraps at a normal line height (no 44px lines).
    if (width > 1000) expect(lines).toBe(1);
    else expect(lines).toBeLessThanOrEqual(3);
    const leading = await page
      .locator('label[for="cadastro-termos"]')
      .evaluate(
        (label) =>
          parseFloat(getComputedStyle(label).lineHeight) /
          parseFloat(getComputedStyle(label).fontSize),
      );
    expect(leading).toBeGreaterThanOrEqual(1.4);
    expect(leading).toBeLessThanOrEqual(1.5);
  }
});
