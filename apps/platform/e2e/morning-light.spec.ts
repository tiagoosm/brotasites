import { expect, type Page, test } from "@playwright/test";

// The morning light (morning-light.tsx over side-rays.tsx, WebGL) lights the sign-in and sign-up
// pages since 2026-11-05, no longer the home page, always behind their card. It draws only with a
// GPU and only while it is on screen.

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

/** Records the shader's clock (uTime) each frame, as the light draws it. */
function recordTime(page: Page) {
  return page.addInitScript(() => {
    const store = window as unknown as { rayTimes: number[] };
    store.rayTimes = [];
    const names = new WeakMap<object, string>();
    const locate = WebGL2RenderingContext.prototype.getUniformLocation;
    WebGL2RenderingContext.prototype.getUniformLocation = function (program, name) {
      const location = locate.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    const set = WebGL2RenderingContext.prototype.uniform1f;
    WebGL2RenderingContext.prototype.uniform1f = function (location, value) {
      if (location && names.get(location) === "uTime") store.rayTimes.push(value);
      return set.call(this, location, value);
    };
  });
}
const lastTime = (page: Page) =>
  page.evaluate(() => (window as unknown as { rayTimes: number[] }).rayTimes.at(-1) ?? 0);

test("the light moves: its clock runs and the beams change (E30)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one size is enough");
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await countDraws(page, true);
  await recordTime(page);
  await page.goto("/entrar");
  await expect.poll(() => draws(page), { timeout: 15_000 }).toBeGreaterThan(5);
  const light = page.locator("[data-morning-light]");
  const startTime = await lastTime(page);
  const before = await light.screenshot();
  await page.waitForTimeout(3000);
  // In E27 the clock ran at 0.24 a second over beams so wide they were a flat veil: nothing
  // visible moved. Now it runs at 1 a second (in a slow test browser, at least half of that).
  expect((await lastTime(page)) - startTime).toBeGreaterThan(1.2);
  const after = await light.screenshot();
  expect(after.equals(before)).toBe(false);
  // The still beams step back once the moving ones draw.
  expect(
    await page.locator(".morning-beams").evaluate((element) => getComputedStyle(element).opacity),
  ).toBe("0");
});

test("with reduced motion the light stays still: no canvas, no frames (E30)", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "one size is enough");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await countDraws(page, true);
  await page.goto("/entrar");
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBe(0);
  await expect(page.locator("[data-morning-light] canvas")).toHaveCount(0);
  // The still light carries the whole look.
  expect(
    await page.locator(".morning-beams").evaluate((element) => getComputedStyle(element).opacity),
  ).toBe("1");
});

test("the light pauses while the tab is hidden (E30)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one size is enough");
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await countDraws(page, true);
  await page.goto("/entrar");
  await expect.poll(() => draws(page), { timeout: 15_000 }).toBeGreaterThan(5);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
  const paused = await draws(page);
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBeLessThanOrEqual(paused + 1);
});

for (const path of ["/entrar", "/cadastro"]) {
  test(`the light rays draw on ${path}, behind the card`, async ({ page }) => {
    test.setTimeout(90_000);
    await countDraws(page, true);
    await page.goto(path);
    await expect.poll(() => draws(page), { timeout: 15_000 }).toBeGreaterThan(5);
    // The card is on top: its whole face belongs to it, not to the light's canvas.
    const covered = await page.evaluate(() => {
      const card = document.querySelector("[data-auth-card]") as HTMLElement;
      const box = card.getBoundingClientRect();
      const points = [
        [box.left + 24, box.top + 24],
        [box.right - 24, box.top + 24],
        [box.left + box.width / 2, box.top + box.height / 2],
        [box.left + 24, Math.min(box.bottom, window.innerHeight) - 24],
      ];
      return points.every(([x, y]) => {
        const hit = document.elementFromPoint(x as number, y as number);
        return Boolean(hit && card.contains(hit));
      });
    });
    expect(covered).toBe(true);
    const lightBehind = await page.evaluate(() => {
      // The light's layer, the main's first child, stacks under the card.
      const layer = document.querySelector("main > [aria-hidden='true']");
      return layer?.querySelector("canvas") ? Number(getComputedStyle(layer).zIndex) : 0;
    });
    expect(lightBehind).toBeLessThan(0);
  });
}

test("the sign-in and sign-up pages share one frame, only the card changes", async ({ page }) => {
  // The sign-up card is wider from 768px (two columns, E26); everything else is the same.
  const frame = async (path: string) => {
    await page.goto(path);
    return page.evaluate(() => {
      const card = document.querySelector("[data-auth-card]") as HTMLElement;
      const style = getComputedStyle(card);
      return {
        page: getComputedStyle(document.querySelector("main") as HTMLElement).backgroundColor,
        width: Math.round(card.getBoundingClientRect().width),
        radius: style.borderRadius,
        background: style.backgroundColor,
        light: Boolean(document.querySelector("main > [aria-hidden='true']")),
      };
    });
  };
  const { width: signInWidth, ...signIn } = await frame("/entrar");
  expect(signIn.light).toBe(true);
  const { width: signUpWidth, ...signUp } = await frame("/cadastro");
  expect(signUp).toEqual(signIn);
  const wide = (page.viewportSize()?.width ?? 0) >= 768;
  if (wide) expect(signUpWidth).toBeGreaterThan(signInWidth);
  else expect(signUpWidth).toBe(signInWidth);
});

test("the home page has no light rays", async ({ page }) => {
  test.setTimeout(90_000);
  await countDraws(page, true);
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
