import { expect, test } from "@playwright/test";

// The account pages fit (E26): on laptops and larger the header, the card and the compact footer
// fit with no scroll; on short screens and phones the card is never cut and the page scrolls to
// its end. The morning light stays visible around the card, behind it.

const pages = ["/entrar", "/cadastro", "/esqueci-senha", "/redefinir-senha"];
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

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "each test sets its own screen sizes");
});

for (const path of pages) {
  test(`${path} fits a laptop screen with no scroll`, async ({ page }) => {
    for (const [width, height] of laptops) {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await expect(page.locator("[data-auth-card]")).toBeVisible();
      const { scroll, screen } = await page.evaluate(() => ({
        scroll: document.scrollingElement?.scrollHeight ?? 0,
        screen: window.innerHeight,
      }));
      expect(scroll, `${width}×${height}`).toBeLessThanOrEqual(screen);
    }
  });

  test(`${path} is never cut on smaller screens`, async ({ page }) => {
    for (const [width, height] of others) {
      await page.setViewportSize({ width, height });
      await page.goto(path);
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
    // Nothing moves: no beams canvas at all.
    await expect(page.locator("[data-morning-light] canvas")).toHaveCount(0);
  }
  await context.close();
});
