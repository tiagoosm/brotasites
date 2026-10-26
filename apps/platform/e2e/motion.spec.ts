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

// Titles revealed word by word (split-words.tsx).

const splitTitles = [
  "Sete perguntas, uma de cada vez.",
  "O que todo site tem",
  "Quanto custa",
  "Dúvidas",
  "Seu site está a sete perguntas de distância.",
];

test("screen readers get each split title whole, once", async ({ page }) => {
  await page.goto("/");
  for (const name of splitTitles) {
    const heading = page.getByRole("heading", { name, exact: true });
    await expect(heading, name).toHaveCount(1);
    await expect(heading, name).toHaveAccessibleName(name);
    expect(await heading.locator('.word:not([aria-hidden="true"])').count(), name).toBe(0);
  }
});

test("split titles wrap exactly like plain text", async ({ page }) => {
  await page.goto("/");
  const differences = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("h2[aria-label]")]
      .map((heading) => {
        const plain = heading.cloneNode(false) as HTMLElement;
        plain.removeAttribute("id");
        // The same text, unsplit, with the same second line as the original.
        for (const part of heading.children) {
          const span = document.createElement("span");
          span.className = part.className;
          span.textContent = part.textContent;
          plain.append(span);
        }
        plain.style.cssText = `position:absolute;visibility:hidden;width:${heading.getBoundingClientRect().width}px`;
        heading.after(plain);
        const height = (element: HTMLElement) => Math.round(element.getBoundingClientRect().height);
        const result = {
          title: heading.getAttribute("aria-label"),
          split: height(heading),
          plain: height(plain),
        };
        plain.remove();
        return result;
      })
      .filter((result) => result.split !== result.plain),
  );
  expect(differences).toEqual([]);
});

test("the hero title stays still, so the largest paint is not delayed", async ({ page }) => {
  await page.goto("/");
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveText("Sete perguntas e seu site pronto.");
  expect(await title.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(
    0,
  );
  await expect(title).toHaveCSS("opacity", "1");
});

test("a section title enters word by word, in at most 600ms, once", async ({ page }) => {
  await page.goto("/");
  const title = page.locator("#recursos-titulo");
  await expect(title).toHaveAttribute("data-entry", "waiting");
  await title.scrollIntoViewIfNeeded();
  await expect(title).toHaveAttribute("data-entry", "done");
  const end = await title.locator(".word").evaluateAll((words) =>
    Math.max(
      ...words.map((word) => {
        const style = getComputedStyle(word);
        return (
          Number.parseFloat(style.transitionDelay) * 1000 +
          Number.parseFloat(style.transitionDuration) * 1000
        );
      }),
    ),
  );
  expect(end).toBeLessThanOrEqual(600);
  await settleEntrances(page);
  await expect(title.locator(".word").last()).toHaveCSS("opacity", "1");
});

test("with reduced motion or without JavaScript every word is in place", async ({ browser }) => {
  for (const options of [{ reducedMotion: "reduce" as const }, { javaScriptEnabled: false }]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto("/");
    const out = await page.locator(".word").evaluateAll(
      (words) =>
        words.filter((word) => {
          const style = getComputedStyle(word);
          return (
            style.opacity !== "1" || style.transform !== "none" || word.getAnimations().length > 0
          );
        }).length,
    );
    expect(out, JSON.stringify(options)).toBe(0);
    await context.close();
  }
});
