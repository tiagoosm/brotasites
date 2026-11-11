import { expect, type Page, test } from "@playwright/test";

// The click sparks (E31, click-sparks.tsx): a short burst where a pointer presses, on the
// platform's pages only. One canvas made on the first press, a loop that stops once the strokes
// are gone, at most 40 strokes, nothing in the team's area, on typing fields or with reduced
// motion, and the press itself always does what it did before.

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const sparks = (page: Page) => page.getByTestId("click-sparks");
const live = async (page: Page) => Number((await sparks(page).getAttribute("data-sparks")) ?? 0);

/** A press on the page's free margin, as a mouse or a finger. */
async function press(page: Page, x = 12, y = 420) {
  if (isPhone(page)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function ready(page: Page, path = "/") {
  await page.goto(path);
  // The sparks load after the page (dynamic import): wait until presses spark.
  await expect(page.locator("html")).toHaveAttribute("data-sparks", "ready", { timeout: 15_000 });
}

test("a press makes one canvas, a short burst, and the loop stops once it fades", async ({
  page,
}) => {
  await ready(page);
  await expect(sparks(page)).toHaveCount(0);
  await press(page);
  await expect(sparks(page)).toHaveCount(1);
  // Fewer strokes on touch screens.
  expect(await live(page)).toBe(isPhone(page) ? 5 : 7);
  const canvas = sparks(page);
  await expect(canvas).toHaveAttribute("aria-hidden", "true");
  await expect(canvas).toHaveCSS("pointer-events", "none");
  await expect(canvas).toHaveCSS("position", "fixed");
  // Above the content, below the header (30) and its menus.
  await expect(canvas).toHaveCSS("z-index", "15");
  // Gone within about 0.6 s: no stroke left, nothing drawn, no frame scheduled.
  await expect.poll(() => live(page), { timeout: 2000 }).toBe(0);
  const frames = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="click-sparks"]');
        const data = canvas?.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0;
        for (let i = 3; data && i < data.length; i += 4) ink += data[i] ? 1 : 0;
        resolve(ink);
      }),
  );
  expect(frames).toBe(0);
  // Still one canvas after more presses.
  await press(page, 14, 440);
  await expect(sparks(page)).toHaveCount(1);
});

test("never more than 40 strokes, however fast the presses", async ({ page }) => {
  await ready(page);
  for (let i = 0; i < 20; i++) await press(page, 12, 300 + i * 4);
  expect(await live(page)).toBeLessThanOrEqual(40);
  expect(await live(page)).toBeGreaterThan(0);
});

test("a press on a link still follows it", async ({ page }) => {
  await ready(page);
  const link = page.getByRole("contentinfo").getByRole("link", { name: "Termos de uso" });
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(page).toHaveURL(/\/termos$/);
  await expect(sparks(page)).toHaveCount(1);
});

test("no sparks on fields people type in", async ({ page }) => {
  await ready(page, "/entrar");
  await page.getByLabel("E-mail").click();
  await page.getByLabel("Senha", { exact: true }).click();
  await expect(sparks(page)).toHaveCount(0);
  // The rest of the screen still sparks.
  await press(page, 8, 200);
  await expect(sparks(page)).toHaveCount(1);
});

test("no sparks with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await press(page);
  await press(page, 14, 440);
  await page.waitForTimeout(200);
  await expect(sparks(page)).toHaveCount(0);
});

test("no sparks in the team's area, on its own host", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one browser is enough for the admin host");
  await page.goto("http://admin.localhost:3101/entrar?voltar=%2Fadmin");
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.mouse.click(8, 200);
  await page.mouse.click(12, 300);
  await page.waitForTimeout(200);
  await expect(sparks(page)).toHaveCount(0);
});

test("the sparks are yellow only (the pollen token)", async ({ page }) => {
  // Every stroke the canvas draws, recorded as it is drawn (no race with the fade).
  await page.addInitScript(() => {
    const store = window as unknown as { strokes: string[] };
    store.strokes = [];
    const stroke = CanvasRenderingContext2D.prototype.stroke as (
      this: CanvasRenderingContext2D,
      ...args: unknown[]
    ) => void;
    CanvasRenderingContext2D.prototype.stroke = function (
      this: CanvasRenderingContext2D,
      ...args: unknown[]
    ) {
      if (this.canvas.dataset.testid === "click-sparks")
        store.strokes.push(String(this.strokeStyle));
      stroke.apply(this, args);
    } as CanvasRenderingContext2D["stroke"];
  });
  await ready(page);
  await press(page);
  await expect(sparks(page)).toHaveCount(1);
  await expect.poll(() => live(page), { timeout: 2000 }).toBe(0);
  const pollen = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--pollen").trim().toLowerCase(),
  );
  const strokes = await page.evaluate(() => (window as unknown as { strokes: string[] }).strokes);
  expect(strokes.length).toBeGreaterThan(0);
  expect(new Set(strokes.map((color) => color.toLowerCase()))).toEqual(new Set([pollen]));
});
