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

test("the hero title enters word by word in CSS, whole in the HTML, wrapping as plain text (E31)", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const sizes = [
    [360, 640],
    [390, 844],
    [768, 1024],
    [1280, 600],
    [1366, 650],
    [1440, 900],
  ] as const;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const title = page.getByRole("heading", { level: 1 });
    // One name for assistive technology, the whole text in the HTML, the pieces hidden.
    await expect(title).toHaveAccessibleName("5 passos e seu site pronto.");
    expect((await title.textContent())?.replace(/\s+/g, " ").trim()).toBe(
      "5 passos e seu site pronto.",
    );
    const words = title.locator(".word");
    await expect(words).toHaveCount(6);
    for (const word of await words.all()) {
      await expect(word).toHaveAttribute("aria-hidden", "true");
      await expect(word).toHaveCSS("white-space", "nowrap");
    }
    await expect(words.first()).toHaveCSS("animation-name", "title-rise");
    // Opaque from the first frame (no fade): the largest paint never waits for it.
    const keyframes = await page.evaluate(() => {
      const word = document.querySelector("h1 .word");
      const effect = word?.getAnimations()[0]?.effect as KeyframeEffect | undefined;
      return (effect?.getKeyframes() ?? []).map((frame) => ({
        opacity: frame.opacity ?? null,
        transform: String(frame.transform ?? ""),
      }));
    });
    expect(keyframes.length).toBeGreaterThan(0);
    expect(keyframes.every((frame) => frame.opacity === null)).toBe(true);
    // A rise of 0.32em (computed in px against the title's size).
    const rise = Number(/translateY\(([\d.]+)px\)/.exec(keyframes[0]?.transform ?? "")?.[1]);
    const size = Number.parseFloat(await title.evaluate((h1) => getComputedStyle(h1).fontSize));
    expect(rise / size).toBeCloseTo(0.32, 2);
    // Once it has settled, it wraps exactly as the same title in plain text.
    await page.waitForTimeout(900);
    const layout = await page.evaluate(() => {
      const h1 = document.querySelector("h1") as HTMLElement;
      const plain = document.createElement("h1");
      plain.className = h1.className;
      plain.innerHTML = '5 passos <span class="block text-stem">e seu site pronto.</span>';
      plain.style.cssText = `position:absolute;visibility:hidden;width:${h1.clientWidth}px`;
      h1.parentElement?.append(plain);
      // Which line each word sits on, from the top of its own title.
      const top = (rect: DOMRect, root: Element) =>
        Math.round((rect.top - root.getBoundingClientRect().top) / 4);
      const splitTops = [...h1.querySelectorAll(".word")].map((word) =>
        top(word.getBoundingClientRect(), h1),
      );
      const plainTops: number[] = [];
      const plainWidths: number[] = [];
      const splitWidths = [...h1.querySelectorAll(".word")].map(
        (word) => word.getBoundingClientRect().width,
      );
      const walker = document.createTreeWalker(plain, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        for (const match of text.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index ?? 0);
          range.setEnd(node, (match.index ?? 0) + match[0].length);
          plainTops.push(top(range.getBoundingClientRect(), plain));
          plainWidths.push(range.getBoundingClientRect().width);
        }
      }
      // Line numbers, not px: a word box and a run of text sit at slightly different tops.
      const lineOf = (tops: number[]) => {
        const lines = [...new Set(tops)].sort((a, b) => a - b);
        return tops.map((value) => lines.indexOf(value));
      };
      const result = {
        height: h1.getBoundingClientRect().height,
        plainHeight: plain.getBoundingClientRect().height,
        splitTops: lineOf(splitTops),
        // Each word as wide as in plain text: the letter spans keep the kerning.
        widthGap: Math.max(...splitWidths.map((w, i) => Math.abs(w - (plainWidths[i] ?? 0)))),
        plainTops: lineOf(plainTops),
        fontSize: getComputedStyle(h1).fontSize,
      };
      plain.remove();
      return result;
    });
    expect(layout.height, `${width}px`).toBeCloseTo(layout.plainHeight, 0);
    expect(layout.splitTops, `${width}px`).toEqual(layout.plainTops);
    expect(layout.widthGap, `${width}px`).toBeLessThan(0.5);
    // The same sizes as before: 3.25rem, 5rem from 640px, 6rem from 1024px.
    expect(layout.fontSize).toBe(width >= 1024 ? "96px" : width >= 640 ? "80px" : "52px");
  }
});

test("the hero title stays still with reduced motion and without JavaScript (E31)", async ({
  browser,
}) => {
  const reduced = await browser.newContext({ reducedMotion: "reduce" });
  const still = await reduced.newPage();
  await still.goto("/");
  await expect(still.locator("h1 .word").first()).toHaveCSS("animation-name", "none");
  await reduced.close();
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const plain = await noScript.newPage();
  await plain.goto("/");
  await expect(plain.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "5 passos e seu site pronto.",
  );
  await expect(plain.locator("h1 .word").first()).toHaveCSS("animation-name", "none");
  await noScript.close();
});

test("the mouse vine is on the account pages too, and draws in their free space (E31)", async ({
  page,
}) => {
  test.skip(isPhone(page), "No vine on touch screens.");
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ["/entrar", "/cadastro"]) {
    await page.goto(path);
    const vine = page.getByTestId("site-vine");
    await expect(vine.locator("canvas"), path).toHaveCount(1);
    await expect(vine).toHaveCSS("pointer-events", "none");
    await page.waitForTimeout(800);
    // Down the free left side of the page, away from the card.
    for (let y = 250; y <= 650; y += 8) {
      await page.mouse.move(60, y);
      await page.waitForTimeout(8);
    }
    expect((await vineInk(page))?.count, path).toBeGreaterThan(0);
  }
});

test("the hero title's letters lift near the mouse and settle back (E31)", async ({ page }) => {
  test.skip(isPhone(page), "Mouse only.");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForTimeout(1000);
  const letters = page.locator("#hero-titulo .char");
  await expect(letters).toHaveCount(22);
  const tops = () =>
    letters.evaluateAll((all) => all.map((el) => Number.parseFloat(getComputedStyle(el).top) || 0));
  const size = await page
    .locator("#hero-titulo")
    .evaluate((h1) => Number.parseFloat(getComputedStyle(h1).fontSize));
  // Over the "s" in "passos" (the fifth letter).
  const box = await letters.nth(4).boundingBox();
  if (!box) throw new Error("no letter");
  await page.mouse.move(box.x - 60, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await page.waitForTimeout(600);
  const lifted = await tops();
  // The letter under the cursor rises the most (about 0.14em), its neighbours less, the far
  // ones not at all.
  expect(lifted[4] ?? 0).toBeLessThan(-0.1 * size);
  expect(lifted[4] ?? 0).toBeLessThan(lifted[2] ?? 0);
  expect(lifted.at(-1)).toBe(0);
  // Away from the title, everything settles back.
  await page.mouse.move(box.x, box.y + 400, { steps: 4 });
  await expect.poll(async () => (await tops()).every((top) => top === 0)).toBe(true);
});

test("the hero title's letters stay still with reduced motion (E31)", async ({ page }) => {
  test.skip(isPhone(page), "Mouse only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForTimeout(800);
  const box = await page.locator("#hero-titulo .char").nth(4).boundingBox();
  if (!box) throw new Error("no letter");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await page.waitForTimeout(400);
  const tops = await page
    .locator("#hero-titulo .char")
    .evaluateAll((all) => all.map((el) => getComputedStyle(el).top));
  expect(new Set(tops)).toEqual(new Set(["0px"]));
});
