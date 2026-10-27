import { expect, type Page, test } from "@playwright/test";

// The price card's border glow (glow-card.tsx): it follows the mouse on the rim and outside
// the card only, stays still on touch screens and with reduced motion.

const card = (page: Page) => page.locator(".glow-card");

async function cardBox(page: Page) {
  await card(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const box = await card(page).boundingBox();
  if (!box) throw new Error("no card");
  return box;
}

test("the glow follows the mouse and rests when it leaves", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, "the glow follows a mouse");
  await page.goto("/");
  const box = await cardBox(page);
  await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2, { steps: 5 });
  await expect
    .poll(() =>
      card(page).evaluate((el) => Number.parseFloat(el.style.getPropertyValue("--glow-angle"))),
    )
    .toBeCloseTo(90, 0);
  expect(
    await card(page).evaluate((el) => Number(el.style.getPropertyValue("--glow-strength"))),
  ).toBeGreaterThan(0.9);
  await page.mouse.move(0, 0);
  await expect
    .poll(() => card(page).evaluate((el) => el.style.getPropertyValue("--glow-angle")))
    .toBe("");
});

test("inside the card the background stays white while it glows", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, "the glow follows a mouse");
  test.setTimeout(90_000);
  await page.goto("/");
  const box = await cardBox(page);
  await page.mouse.move(box.x + box.width - 4, box.y + 30, { steps: 5 });
  await page.waitForTimeout(400);
  // A strip just inside the lit corner, where the halo is strongest.
  const png = (
    await page.screenshot({
      clip: { x: box.x + box.width - 26, y: box.y + 12, width: 14, height: 60 },
    })
  ).toString("base64");
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
    for (let i = 0; i < pixels.length; i += 4) {
      min = Math.min(min, pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0);
    }
    return min;
  }, png);
  expect(darkest).toBeGreaterThanOrEqual(250);
});

test("on touch screens and with reduced motion the glow stays still and soft", async ({
  browser,
}) => {
  for (const options of [
    { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true },
    { viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" as const },
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto("/");
    const box = await cardBox(page);
    if (options.viewport.width >= 768) {
      await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2, { steps: 5 });
    } else {
      await page.touchscreen.tap(box.x + box.width - 10, box.y + 10);
    }
    expect(await card(page).evaluate((el) => el.style.getPropertyValue("--glow-angle"))).toBe("");
    const rim = await card(page).evaluate((el) => Number(getComputedStyle(el, "::before").opacity));
    expect(rim).toBeGreaterThan(0);
    expect(rim).toBeLessThanOrEqual(0.5);
    if (options.viewport.width < 768) {
      // No halo on phones.
      expect(await card(page).evaluate((el) => getComputedStyle(el, "::after").content)).toBe(
        "none",
      );
    }
    await context.close();
  }
});
