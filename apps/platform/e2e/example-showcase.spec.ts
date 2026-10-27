import { expect, test } from "@playwright/test";

// "Veja um site de verdade" (example-showcase.tsx): the example site in a frame that grows
// with the scroll on wide screens, without ever holding the scroll.

const scaleOf = (transform: string) =>
  transform === "none" ? 1 : Number(transform.match(/matrix\(([^,]+)/)?.[1] ?? 1);

test("the frame describes the example and links to it, and its page is out of reach", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: "Veja um site de verdade" });
  await expect(
    section.getByRole("img", { name: /site de exemplo da Padaria do Zé/ }),
  ).toBeVisible();
  const frame = section.locator("iframe");
  await expect(frame).toHaveAttribute("inert", "");
  await expect(frame).toHaveAttribute("tabindex", "-1");

  await section.getByRole("link", { name: "Abrir o site de exemplo completo" }).click();
  await expect(page).toHaveURL(/\/exemplo$/);
});

test("no sideways scroll at 360, 375, 768 and 1280px", async ({ page }) => {
  for (const width of [360, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.locator(".example-window").scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${width}px`).toBe(0);
  }
});

test("on wide screens the frame grows with the scroll and never holds it", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 769, "phones get the full-size frame");
  await page.goto("/");
  const window = page.locator(".example-window");
  const top = await window.evaluate((element) => element.getBoundingClientRect().top + scrollY);
  const at = async (y: number) => {
    await page.evaluate((value) => scrollTo(0, value), y);
    await page.waitForTimeout(100);
    return scaleOf(await window.evaluate((element) => getComputedStyle(element).transform));
  };
  const viewport = page.viewportSize()?.height ?? 800;
  const start = await at(top - viewport);
  // Fully open by the time its top reaches the header.
  const end = await at(top - 64);
  expect(start).toBeLessThan(0.97);
  expect(end).toBeCloseTo(1, 2);

  // Wheel over the frame: the page scrolls by the whole amount, every time.
  await page.evaluate((y) => scrollTo(0, y), top - viewport * 0.6);
  const box = await window.boundingBox();
  await page.mouse.move((box?.x ?? 0) + 200, (box?.y ?? 0) + 100);
  for (let i = 0; i < 4; i++) {
    const before = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 120);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(before + 120);
  }
});

test("phones and reduced motion get the full-size frame", async ({ browser }) => {
  for (const options of [
    { viewport: { width: 375, height: 812 } },
    { viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" as const },
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto("/");
    const window = page.locator(".example-window");
    await window.scrollIntoViewIfNeeded();
    await expect(window).toHaveCSS("transform", "none");
    expect(await window.evaluate((element) => element.getAnimations().length)).toBe(0);
    await context.close();
  }
});

test("the example page loads only when the frame is about to show", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto("/");
  const frame = page.locator(".example-window iframe");
  await expect(frame).not.toHaveAttribute("src");
  await frame.scrollIntoViewIfNeeded();
  await expect(frame).toHaveAttribute("src", "/exemplo-site/index.html");
  await context.close();
});

test("without JavaScript the frame still shows the example", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator('.example-window iframe[src="/exemplo-site/index.html"]')).toHaveCount(
    1,
  );
  await context.close();
});
