import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// The home page's motion and navigation (E18): one way in from the header, entrances that come
// back each time, the smooth scroll to a section, the organic stem, and everything still
// there without JavaScript or with reduced motion.

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

/** Opens the phone menu when needed, then clicks a section link. */
async function goToSection(page: Page, name: string) {
  if (isPhone(page)) {
    const button = page.getByRole("button", { name: "Abrir menu" });
    const sheet = page.getByRole("dialog", { name: "Menu" });
    await expect(async () => {
      await button.click();
      await expect(sheet).toBeVisible({ timeout: 1000 });
    }).toPass();
    await sheet.getByRole("link", { name }).click();
  } else {
    await page
      .getByRole("banner")
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name })
      .click();
  }
}

/**
 * Every revealed element on screen is fully shown (none left invisible). "On screen" stops at
 * the entrance line (92% down): an element only in the last sliver is still on its way in.
 */
async function nothingHiddenOnScreen(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-reveal]")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.bottom > 0 && box.top < window.innerHeight * 0.92;
      })
      .every((element) => {
        if (element.dataset.entry === "waiting") return false;
        const target =
          element.dataset.reveal === "words" ? element.querySelector(".word") : element;
        return !target || Number(getComputedStyle(target).opacity) > 0.99;
      }),
  );
}

test("the header offers two ways in: Entrar and Criar conta (E30)", async ({ page }) => {
  await page.goto("/ajuda");
  if (isPhone(page)) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("dialog", { name: "Menu" })
      .getByRole("link", { name: "Entrar", exact: true })
      .click();
  } else {
    await page.getByRole("banner").getByRole("link", { name: "Entrar", exact: true }).click();
  }
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByText("Ainda não tem conta?")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Cadastre-se" })).toHaveAttribute(
    "href",
    "/cadastro",
  );
});

test("entrances come back each time an element returns, and nothing is left hidden", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const title = page.locator("#recursos-titulo");
  // The entrances are prepared once the page is idle.
  await expect.poll(() => title.getAttribute("data-entry")).toBe("waiting");
  await title.scrollIntoViewIfNeeded();
  await expect.poll(() => title.getAttribute("data-entry")).toMatch(/done|shown/);
  await expect.poll(() => nothingHiddenOnScreen(page)).toBe(true);

  // Back up, far away: it waits again, never while still visible.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => title.getAttribute("data-entry")).toBe("waiting");
  // And down again: it enters again, words and all.
  await title.scrollIntoViewIfNeeded();
  await expect.poll(() => title.getAttribute("data-entry")).toMatch(/done|shown/);
  await expect.poll(() => nothingHiddenOnScreen(page)).toBe(true);

  // Up from below works the same way.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => title.getAttribute("data-entry")).toBe("waiting");
  await title.scrollIntoViewIfNeeded();
  await expect.poll(() => nothingHiddenOnScreen(page)).toBe(true);
});

test("the section links scroll smoothly there, with the title focused", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const positions: number[] = [];
  const sample = setInterval(() => {
    page
      .evaluate(() => window.scrollY)
      .then(
        (y) => positions.push(y),
        () => {},
      );
  }, 40);
  await goToSection(page, "Preço");
  const title = page.locator("#preco-titulo");
  await expect(title).toBeFocused({ timeout: 5000 });
  clearInterval(sample);
  await expect(page).toHaveURL(/\/#preco$/);
  // It stops right under the sticky header (the section's top at 64px).
  const top = await page.locator("#preco").evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(top - 64)).toBeLessThanOrEqual(2);
  // Smooth: the window passed through positions on the way, it did not jump.
  const end = await page.evaluate(() => window.scrollY);
  expect(positions.some((y) => y > 0 && y < end - 50)).toBe(true);
  // A long jump shows what it lands on in full, never half-entered.
  await expect.poll(() => nothingHiddenOnScreen(page)).toBe(true);
});

test("from another page, the home page opens and scrolls to the section", async ({ page }) => {
  await page.goto("/ajuda");
  await goToSection(page, "Preço");
  await expect(page).toHaveURL(/\/#preco$/, { timeout: 10_000 });
  await expect(page.locator("#preco-titulo")).toBeFocused({ timeout: 5000 });
  const top = await page.locator("#preco").evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(top - 64)).toBeLessThanOrEqual(2);
});

test("a wheel turn stops the smooth scroll at once", async ({ page }) => {
  test.skip(isPhone(page), "the wheel is a mouse's");
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await goToSection(page, "Preço");
  // Once the scroll is under way.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.mouse.wheel(0, 10);
  const stopped = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(900);
  // It stayed about where the wheel caught it, far from the section.
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - stopped)).toBeLessThan(60);
  await expect(page.locator("#preco-titulo")).not.toBeFocused();
});

test("with reduced motion the links jump and nothing is ever hidden", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Ver como funciona" }).click();
  // Straight there, no animation.
  await expect(page.locator("#como-funciona-titulo")).toBeFocused();
  const top = await page.locator("#como-funciona").evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(top - 64)).toBeLessThanOrEqual(2);
  expect(await page.locator("[data-entry='waiting']").count()).toBe(0);
  await context.close();
});

test("the stem never overlaps the text nor scrolls sideways", async ({ browser }) => {
  test.setTimeout(60_000);
  for (const width of [360, 768, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("ol.stem")).toHaveAttribute("data-stem-measured", "");
    const report = await page.evaluate(() => {
      const overlaps: string[] = [];
      for (const node of document.querySelectorAll<HTMLElement>("ol.stem > li")) {
        const text = [...node.children].filter((child) => !child.classList.contains("stem-anchor"));
        for (const leaf of node.querySelectorAll(".stem-leaf, .stem-bloom")) {
          const l = leaf.getBoundingClientRect();
          for (const block of text) {
            const t = block.getBoundingClientRect();
            if (l.right > t.left + 1 && l.left < t.right && l.bottom > t.top && l.top < t.bottom) {
              overlaps.push(`${leaf.getAttribute("class")} over ${block.tagName}`);
            }
          }
        }
      }
      const svg = document.querySelector(".stem-svg");
      return {
        sideways: document.documentElement.scrollWidth > window.innerWidth,
        overlaps,
        path: document.querySelector(".stem-body")?.getAttribute("d")?.length ?? 0,
        hidden: svg?.getAttribute("aria-hidden"),
      };
    });
    expect(report.sideways, `${width}px`).toBe(false);
    expect(report.overlaps, `${width}px`).toEqual([]);
    expect(report.path).toBeGreaterThan(100);
    expect(report.hidden).toBe("true");
    await context.close();
  }
});

test("without JavaScript the content and the whole stem are there", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const questions = page
    .getByRole("list", { name: "Os 5 passos e o que vem depois" })
    .getByRole("heading", { level: 3 });
  // The 5 steps and the choice of a look.
  await expect(questions).toHaveCount(6);
  expect((await page.locator(".stem-body").getAttribute("d"))?.length ?? 0).toBeGreaterThan(100);
  for (const leaf of await page.locator(".stem-leaf").all())
    await expect(leaf).toHaveCSS("opacity", "1");
  await expect(page.locator("[data-entry]")).toHaveCount(0);
  for (const element of await page.locator("[data-reveal]").all()) {
    await expect(element).toHaveCSS("opacity", "1");
  }
  await context.close();
});

test("the home page passes axe", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).join(" | ")}`),
  ).toEqual([]);
});

test("the decorations never cover the page, with or without a GPU", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  // The hero's title is drawn in ink: its pixels are dark, whatever the vine and the light do.
  const png = (await page.getByRole("heading", { level: 1 }).screenshot()).toString("base64");
  const darkest = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let min = 255;
    for (let i = 0; i < pixels.length; i += 4) min = Math.min(min, pixels[i] ?? 255);
    return min;
  }, png);
  expect(darkest).toBeLessThan(80);
  // The vine (a plain 2D canvas since E31, no GPU needed) is one canvas that never takes clicks.
  const vine = page.getByTestId("site-vine");
  if ((await vine.count()) > 0) {
    await expect(vine.locator("canvas")).toHaveCount(1);
    await expect(vine).toHaveCSS("pointer-events", "none");
  }
});

/** The vine's drawn pixels: how many, and the box they fill, in CSS px. */
function vineInk(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="site-vine"] canvas');
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return null;
    const ratio = canvas.width / window.innerWidth;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    for (let i = 3; i < data.length; i += 4) {
      if ((data[i] ?? 0) <= 8) continue;
      const pixel = (i - 3) / 4;
      const x = pixel % canvas.width;
      const y = Math.floor(pixel / canvas.width);
      count++;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    return {
      count,
      height: count ? (bottom - top) / ratio : 0,
      width: count ? (right - left) / ratio : 0,
    };
  });
}

test("the mouse vine: no leaves, about 140 px of tail, gone soon after the mouse stops (E31)", async ({
  page,
}) => {
  test.skip(isPhone(page), "No vine on touch screens.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const vine = page.getByTestId("site-vine");
  await expect(vine.locator("canvas")).toHaveCount(1);
  await page.waitForTimeout(800);
  // Down the free left margin, 500 px in one go.
  for (let y = 250; y <= 750; y += 8) {
    await page.mouse.move(40, y);
    await page.waitForTimeout(8);
  }
  const moving = await vineInk(page);
  expect(moving?.count).toBeGreaterThan(0);
  // The tail is capped along the path (plus the round caps and the sway).
  expect(moving?.height).toBeLessThanOrEqual(150);
  expect(moving?.width).toBeLessThanOrEqual(12);
  // Gone about 0.4 s after the mouse rests: nothing left on the canvas.
  await page.waitForTimeout(500);
  expect((await vineInk(page))?.count).toBe(0);
});

test("the mouse vine draws nothing with reduced motion (E31)", async ({ page }) => {
  test.skip(isPhone(page), "No vine on touch screens.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("site-vine").locator("canvas")).toHaveCount(1);
  await page.waitForTimeout(800);
  for (let y = 250; y <= 600; y += 10) await page.mouse.move(40, y);
  expect((await vineInk(page))?.count ?? 0).toBe(0);
});
