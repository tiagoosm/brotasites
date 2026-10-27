import { expect, test } from "@playwright/test";

// The hero's main button (specular-link.tsx): a solid link with a light on its rim that
// follows the mouse, still on touch screens.

const heroButton = (page: import("@playwright/test").Page) =>
  page.locator("section").first().getByRole("link", { name: "Criar meu site" });

test("it is a real link to the form, at least 44px tall, with a visible focus outline", async ({
  page,
}) => {
  await page.goto("/");
  const button = heroButton(page);
  await expect(button).toHaveAttribute("href", "/criar/negocio");
  const box = await button.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await button.focus();
  await expect(button).toHaveCSS("outline-style", "solid");
  await expect(button).toHaveCSS("outline-width", "2px");
});

test("its text keeps at least 4.5:1 at rest, on hover and with the light under the cursor", async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, "the light follows a mouse");
  // Four screenshots next to the hero's light rays, which are slow to draw without a GPU.
  test.setTimeout(120_000);
  await page.goto("/");
  const button = heroButton(page);
  const box = await button.boundingBox();
  if (!box) throw new Error("no button");

  // Read from the pixels, since the light is a gradient: with the text hidden for a moment,
  // the lightest point of what is behind it, against the white of the text. The rim, where
  // there is no text, is left out.
  const worstRatio = async () => {
    await button.evaluate((element) => {
      element.style.color = "transparent";
    });
    const png = (await button.screenshot()).toString("base64");
    await button.evaluate((element) => {
      element.style.color = "";
    });
    return page.evaluate(async (data) => {
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
      const channel = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const inset = Math.round(canvas.height * 0.15);
      let lightest = 0;
      for (let y = inset; y < canvas.height - inset; y++) {
        // Between the round ends of the pill.
        for (let x = Math.ceil(canvas.height / 2); x < canvas.width - canvas.height / 2; x++) {
          const i = (y * canvas.width + x) * 4;
          const [r, g, b] = [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0];
          const l = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
          lightest = Math.max(lightest, l);
        }
      }
      return 1.05 / (lightest + 0.05);
    }, png);
  };

  expect(await worstRatio()).toBeGreaterThanOrEqual(4.5);
  for (const [x, y] of [
    [0.5, 0.5],
    [0.15, 0.5],
    [0.85, 0.2],
  ] as const) {
    await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 4 });
    await page.waitForTimeout(300);
    expect(await worstRatio(), `cursor at ${x}, ${y}`).toBeGreaterThanOrEqual(4.5);
  }
});

test("the light follows the mouse and rests when it leaves", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, "the light follows a mouse");
  await page.goto("/");
  const button = heroButton(page);
  const box = await button.boundingBox();
  if (!box) throw new Error("no button");
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.9, { steps: 4 });
  await expect
    .poll(() => button.evaluate((el) => el.style.getPropertyValue("--spec-x")))
    .not.toBe("");
  await page.mouse.move(0, 0);
  await expect.poll(() => button.evaluate((el) => el.style.getPropertyValue("--spec-x"))).toBe("");
});

test("on touch screens the light stays still", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  const button = heroButton(page);
  await button.tap({ trial: true });
  expect(await button.evaluate((el) => el.style.getPropertyValue("--spec-x"))).toBe("");
  const light = await button.evaluate((el) => getComputedStyle(el, "::before").backgroundImage);
  expect(light).toContain("radial-gradient");
  await context.close();
});
