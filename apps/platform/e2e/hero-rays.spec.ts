import { expect, type Page, test } from "@playwright/test";

// The hero's light rays (side-rays.tsx, WebGL) draw only while the hero is on screen: they
// pause when it scrolls away and start again when it comes back.

const draws = (page: Page) =>
  page.evaluate(() => (window as unknown as { rayDraws: number }).rayDraws);

test("the light rays pause off screen and resume on screen", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const store = window as unknown as { rayDraws: number };
    store.rayDraws = 0;
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      // The hero's rays only: the vine that follows the cursor is a fixed WebGL canvas too.
      const canvas = this.canvas as HTMLCanvasElement;
      if (!canvas.closest('[class*="fixed"]')) store.rayDraws += 1;
      return draw.apply(this, args);
    };
  });
  await page.goto("/");
  await expect.poll(() => draws(page), { timeout: 15_000 }).toBeGreaterThan(5);

  // Far below the hero: after the last frame in flight, no more drawing.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  const paused = await draws(page);
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBe(paused);

  // Back at the top: drawing again.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => draws(page), { timeout: 15_000 }).toBeGreaterThan(paused + 5);
});
