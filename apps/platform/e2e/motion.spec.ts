import { expect, type Page, test } from "@playwright/test";
import { settleEntrances } from "./support/contrast";

// Section entrances on the home page (motion-reveal.tsx): the HTML always carries the final
// content, each element enters once, and nothing moves with reduced motion.

const revealed = "[data-reveal]";

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => Math.round(window.innerHeight * 0.5));
  for (let y = 0; y <= height; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(60);
  }
}

test("without JavaScript every section is shown in full", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  const elements = page.locator(revealed);
  expect(await elements.count()).toBeGreaterThan(20);
  const hidden = await elements.evaluateAll(
    (all) => all.filter((element) => getComputedStyle(element).opacity !== "1").length,
  );
  expect(hidden).toBe(0);
  await context.close();
});

test("each element enters once and stays in place", async ({ page }) => {
  await page.goto("/");
  const price = page.locator("#preco [data-reveal]").first();
  await expect(price).toHaveAttribute("data-entry", "waiting");

  await price.scrollIntoViewIfNeeded();
  await expect(price).toHaveAttribute("data-entry", "done");
  await settleEntrances(page);
  await expect(price).toHaveCSS("opacity", "1");

  // Back to the top and down again: it does not play a second time.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  await price.scrollIntoViewIfNeeded();
  await page.waitForTimeout(50);
  expect(await price.evaluate((element) => element.getAnimations().length)).toBe(0);
  await expect(price).toHaveCSS("opacity", "1");
});

test("a question enters when the stem's ink reaches it", async ({ page }) => {
  await page.goto("/");
  const question = page.locator('[data-reveal="stem"]').nth(2);
  await expect(question).toHaveAttribute("data-entry", "waiting");

  // Just on screen, below the tip of the ink: still waiting.
  await question.evaluate((element) => {
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top - window.innerHeight * 0.9);
  });
  await page.waitForTimeout(150);
  await expect(question).toHaveAttribute("data-entry", "waiting");

  // Past two thirds of the screen, where the ink is: it enters.
  await question.evaluate((element) => {
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top - window.innerHeight * 0.5);
  });
  await expect(question).toHaveAttribute("data-entry", "done");
});

test("scrolling the whole page shifts no layout", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const store = window as unknown as { shift: number };
    store.shift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[]) {
        if (!entry.hadRecentInput) store.shift += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await scrollThrough(page);
  await settleEntrances(page);
  const shift = await page.evaluate(() => (window as unknown as { shift: number }).shift);
  expect(shift).toBeLessThan(0.05);
});

test("with reduced motion nothing waits or moves", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  await scrollThrough(page);
  const moving = await page.locator(revealed).evaluateAll(
    (all) =>
      all.filter((element) => {
        const style = getComputedStyle(element);
        return (
          element.hasAttribute("data-entry") ||
          style.opacity !== "1" ||
          style.transform !== "none" ||
          element.getAnimations().length > 0
        );
      }).length,
  );
  expect(moving).toBe(0);
  await context.close();
});
