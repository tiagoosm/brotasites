import { expect, test } from "@playwright/test";

// Every "Criar meu site" button (create-site-button.tsx, E18): a solid link with a light on its
// rim that follows the mouse, eased frame by frame on its own layer, still on touch screens.

const heroButton = (page: import("@playwright/test").Page) =>
  page.getByRole("main").locator("a[data-create-site]").first();
const lightOf = (page: import("@playwright/test").Page) =>
  heroButton(page)
    .locator(".specular-rim [data-specular-light]")
    .evaluate((el) => (el as HTMLElement).style.transform);
const AT_REST = "translate3d(0px, 0px, 0px)";

test("it is a real link to the form, at least 44px tall, with a visible focus outline", async ({
  page,
}) => {
  await page.goto("/");
  const button = heroButton(page);
  await expect(button).toHaveAttribute("href", "/criar");
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
  // The hero title moves the button when its font arrives: measure only after that.
  await page.evaluate(() => document.fonts.ready);
  const button = heroButton(page);
  // The button only follows the mouse once the page's script has loaded; retry until it does,
  // measuring it again each time.
  await expect(async () => {
    const box = await button.boundingBox();
    if (!box) throw new Error("no button");
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5);
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.9, { steps: 4 });
    expect(await lightOf(page)).not.toBe(AT_REST);
  }).toPass();
  // Only a transform moves: the button's own style is untouched.
  expect(await button.evaluate((el) => el.getAttribute("style"))).toBeNull();
  await page.mouse.move(0, 0);
  await expect.poll(() => lightOf(page)).toBe(AT_REST);
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
  await page.waitForTimeout(300);
  expect(await lightOf(page)).toBe(AT_REST);
  const light = await button
    .locator(".specular-rim [data-specular-light]")
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(light).toContain("radial-gradient");
  await context.close();
});

test("every create-site button has the same finish, 44px tall", async ({ page }) => {
  await page.goto("/");
  const inMain = page.getByRole("main").locator("a[data-create-site]");
  // The hero, after the questions and the closing call.
  await expect(inMain).toHaveCount(3);
  for (const link of await inMain.all()) {
    await expect(link).toHaveText(/Criar meu site/);
    await expect(link).toHaveClass(/specular/);
    await expect(link.locator(".specular-rim")).toHaveCount(1);
    expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  // No create-site link without it, anywhere on the page.
  const plain = await page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLAnchorElement>('a[href="/criar"]')].filter(
        (link) =>
          /Criar (meu )?site/.test(link.textContent ?? "") && !link.classList.contains("specular"),
      ).length,
  );
  expect(plain).toBe(0);
  // A visitor's header never offers "Criar meu site" (E26); its one highlight is "Criar conta"
  // (E30), with the same finish, in the bar and in the phone menu.
  await page.goto("/ajuda");
  const isPhone = (page.viewportSize()?.width ?? 0) < 768;
  if (isPhone) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const sheet = page.getByRole("dialog", { name: "Menu" }).locator("a[data-create-site]");
    await expect(sheet).toHaveText(/Criar conta/);
    await expect(sheet).toHaveClass(/specular/);
  } else {
    const bar = page.getByRole("banner").locator("a[data-create-site]");
    await expect(bar).toHaveText(/Criar conta/);
    await expect(bar).toHaveAttribute("href", "/cadastro");
  }
});

test("every main green button has the specular finish, and only those (E30)", async ({ page }) => {
  const check = async () =>
    page.evaluate(() => {
      const visible = (element: Element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      };
      const layers = (element: Element) => element.querySelectorAll("[data-specular-layer]").length;
      const main = [
        ...document.querySelectorAll(
          '[data-slot="button"][data-variant="default"], a[data-create-site]',
        ),
      ].filter(visible);
      const others = [
        ...document.querySelectorAll('[data-slot="button"]:not([data-variant="default"])'),
      ].filter(visible);
      return {
        main: main.length,
        mainWithout: main.filter((element) => layers(element) !== 2).map((e) => e.textContent),
        othersWith: others.filter((element) => layers(element) > 0).map((e) => e.textContent),
      };
    });
  for (const path of ["/entrar", "/cadastro", "/esqueci-senha", "/"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const found = await check();
    expect(found.main, path).toBeGreaterThan(0);
    expect(found.mainWithout, path).toEqual([]);
    expect(found.othersWith, path).toEqual([]);
  }
});

test("a busy or disabled main button keeps its light at rest (E30)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "a mouse is needed");
  await page.goto("/esqueci-senha");
  await page.waitForLoadState("networkidle");
  const button = page.getByRole("button", { name: "Enviar link" });
  await button.evaluate((element) => element.setAttribute("aria-busy", "true"));
  const box = await button.boundingBox();
  await page.mouse.move((box?.x ?? 0) + 4, (box?.y ?? 0) + 4);
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) - 6,
    (box?.y ?? 0) + (box?.height ?? 0) - 6,
    {
      steps: 6,
    },
  );
  await page.waitForTimeout(300);
  const moved = await button
    .locator("[data-specular-light]")
    .first()
    .evaluate((light) => light.style.transform);
  expect(moved === "" || moved === "translate3d(0px, 0px, 0px)").toBe(true);
  // A free one follows the cursor.
  await button.evaluate((element) => element.removeAttribute("aria-busy"));
  await page.mouse.move((box?.x ?? 0) + 6, (box?.y ?? 0) + 6, { steps: 4 });
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) - 6,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
    {
      steps: 6,
    },
  );
  await expect
    .poll(() =>
      button
        .locator("[data-specular-light]")
        .first()
        .evaluate((light) => light.style.transform),
    )
    .not.toBe("translate3d(0px, 0px, 0px)");
});
