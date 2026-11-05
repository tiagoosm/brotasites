import { expect, type Page, test } from "@playwright/test";

// The morning light (morning-light.tsx over side-rays.tsx, WebGL) lights the sign-in page since
// 2026-11-05, no longer the home page. It draws only with a GPU and only while it is on screen.

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
      // The light's rays only: the vine that follows the cursor is a fixed WebGL canvas too.
      const canvas = this.canvas as HTMLCanvasElement;
      if (!canvas.closest('[class*="fixed"]')) store.rayDraws += 1;
      return draw.apply(this, args);
    };
  }, asIfGpu);
}

test("the light rays draw on the sign-in page, and no longer on the home page", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await countDraws(page, true);
  await page.goto("/entrar");
  await expect.poll(() => draws(page), { timeout: 15_000 }).toBeGreaterThan(5);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBe(0);
});

test("without a GPU the light rays stay off, so the page never draws them in software", async ({
  page,
}) => {
  await countDraws(page, false);
  await page.goto("/entrar");
  const renderer = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  });
  test.skip(!/swiftshader/i.test(renderer), "this browser has a GPU");
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBe(0);
});
