import { expect, type Page, test } from "@playwright/test";

// The hero's light rays (side-rays.tsx, WebGL) draw only with a GPU and only while the hero is
// on screen: they pause when it scrolls away and start again when it comes back.

const draws = (page: Page) =>
  page.evaluate(() => (window as unknown as { rayDraws: number }).rayDraws);

/** Counts the rays' frames; with `asIfGpu`, lets them draw in this browser's software WebGL. */
function countDraws(page: Page, asIfGpu: boolean) {
  return page.addInitScript((gpu) => {
    const store = window as unknown as { rayDraws: number };
    store.rayDraws = 0;
    if (gpu) {
      // The test browser draws WebGL in software (SwiftShader); pretend it is a GPU.
      const getParameter = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (name: number) {
        const value = getParameter.call(this, name);
        return typeof value === "string" && /swiftshader/i.test(value) ? "Test GPU" : value;
      };
    }
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      // The hero's rays only: the vine that follows the cursor is a fixed WebGL canvas too.
      const canvas = this.canvas as HTMLCanvasElement;
      if (!canvas.closest('[class*="fixed"]')) store.rayDraws += 1;
      return draw.apply(this, args);
    };
  }, asIfGpu);
}

test("the light rays pause off screen and resume on screen", async ({ page }) => {
  test.setTimeout(90_000);
  await countDraws(page, true);
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

test("without a GPU the light rays stay off, so the page never draws them in software", async ({
  page,
}) => {
  await countDraws(page, false);
  await page.goto("/");
  const renderer = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  });
  test.skip(!/swiftshader/i.test(renderer), "this browser has a GPU");
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBe(0);
});
