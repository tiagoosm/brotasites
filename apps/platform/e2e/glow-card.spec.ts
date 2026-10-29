import { expect, type Page, test } from "@playwright/test";

// The price card's border glow (glow-card.tsx, E18): at rest it turns slowly round the border
// on its own; the mouse takes over (the short way round, stronger near the edge) and, when it
// leaves, the turn goes on from where it stopped. Touch screens keep turning; reduced motion
// keeps a still, soft glow. The rim and the halo only: the inside stays white.

const card = (page: Page) => page.locator(".glow-card");
const spin = (page: Page) => page.locator(".glow-ring .glow-spin");
const angle = (page: Page) =>
  spin(page).evaluate((el) => Number.parseFloat(getComputedStyle(el).rotate) || 0);
const norm = (value: number) => ((value % 360) + 360) % 360;
const apart = (a: number, b: number) => {
  const d = Math.abs(norm(a) - norm(b));
  return Math.min(d, 360 - d);
};

async function cardBox(page: Page) {
  await card(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const box = await card(page).boundingBox();
  if (!box) throw new Error("no card");
  return box;
}

test("at rest the glow turns round the border by itself", async ({ page }) => {
  await page.goto("/");
  await cardBox(page);
  const before = await angle(page);
  await page.waitForTimeout(1500);
  const after = await angle(page);
  // One turn in 12 s: about 45 degrees in 1.5 s, always the same way.
  expect(apart(before, after)).toBeGreaterThan(20);
  expect(apart(before, after)).toBeLessThan(80);
});

test("the mouse takes over and the turn resumes from there when it leaves", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, "the glow follows a mouse");
  await page.goto("/");
  const box = await cardBox(page);
  // The right edge of the card: 90 degrees, and strong.
  await page.mouse.move(box.x + box.width + 40, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2, { steps: 5 });
  await expect.poll(async () => apart(await angle(page), 90)).toBeLessThan(4);
  await expect(card(page)).toHaveAttribute("data-glow-following", "");
  const strength = await page
    .locator(".glow-ring")
    .evaluate((el) => Number(el.style.getPropertyValue("--glow-strength")));
  expect(strength).toBeGreaterThan(0.9);
  // The bottom edge: 180 degrees, reached by easing, not a jump.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 6, { steps: 3 });
  await expect.poll(async () => apart(await angle(page), 180)).toBeLessThan(6);

  const stopped = await angle(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 120);
  await expect(card(page)).not.toHaveAttribute("data-glow-following", "");
  // Right after leaving it is still where it stopped, then it turns on from there.
  expect(apart(await angle(page), stopped)).toBeLessThan(12);
  await page.waitForTimeout(1500);
  expect(apart(await angle(page), stopped)).toBeGreaterThan(20);
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

test("touch screens keep the slow turn; reduced motion keeps a still, soft glow", async ({
  browser,
}) => {
  const touch = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  let page = await touch.newPage();
  await page.goto("/");
  let box = await cardBox(page);
  await page.touchscreen.tap(box.x + box.width - 10, box.y + 10);
  const first = await angle(page);
  await page.waitForTimeout(1200);
  expect(apart(first, await angle(page))).toBeGreaterThan(15);
  // No halo on phones.
  await expect(page.locator(".glow-halo")).toHaveCSS("display", "none");
  await touch.close();

  const reduced = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  page = await reduced.newPage();
  await page.goto("/");
  box = await cardBox(page);
  await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2, { steps: 5 });
  await page.waitForTimeout(600);
  expect(await angle(page)).toBe(-45);
  await expect(card(page)).not.toHaveAttribute("data-glow-following", "");
  const rim = await page
    .locator(".glow-ring")
    .evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(rim).toBeGreaterThan(0);
  expect(rim).toBeLessThanOrEqual(0.5);
  await reduced.close();
});
