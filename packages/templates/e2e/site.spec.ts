import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

const fixture = JSON.parse(
  readFileSync(new URL("./fixture/site-config.json", import.meta.url), "utf8"),
) as {
  sections: { id: string; enabled: boolean }[];
  business: { contact: { whatsapp: string } };
  seo: { title: string; description: string };
};

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

// Keep the tests hermetic: only the local site is loaded (no Google Maps, no analytics).
test.beforeEach(async ({ page, baseURL }) => {
  await page.route("**/*", (route) =>
    route
      .request()
      .url()
      .startsWith(baseURL ?? "")
      ? route.continue()
      : route.abort(),
  );
});

test.describe("page structure", () => {
  test("renders the enabled sections in the order chosen by the client", async ({ page }) => {
    await page.goto("/");
    const expected = fixture.sections
      .filter((section) => section.enabled)
      .map((section) => section.id);
    const rendered = await page
      .locator("main > section[id]")
      .evaluateAll((sections) => sections.map((section) => section.id));
    expect(rendered).toEqual(expected);
  });

  test("has one h1 and every section is labelled by its heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    for (const section of await page.locator("main > section[id]").all()) {
      const labelledBy = await section.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();
      await expect(page.locator(`#${labelledBy}`)).toBeAttached();
    }
  });

  test("sets SEO and sharing metadata from the config", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(fixture.seo.title);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      fixture.seo.description,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://padaria-do-ze.brotasites.com/",
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /^https:\/\//,
    );
    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
    );
    expect(jsonLd).toMatchObject({ "@type": "LocalBusiness", name: "Padaria do Zé" });
  });

  test("images have alt text and fixed dimensions", async ({ page }) => {
    await page.goto("/");
    const images = await page.locator("img").evaluateAll((imgs) =>
      imgs.map((img) => ({
        alt: img.getAttribute("alt"),
        width: img.getAttribute("width"),
        height: img.getAttribute("height"),
      })),
    );
    expect(images.length).toBeGreaterThanOrEqual(6);
    for (const image of images) {
      expect(image.alt).not.toBeNull();
      expect(Number(image.width)).toBeGreaterThan(0);
      expect(Number(image.height)).toBeGreaterThan(0);
    }
    await expect(page.locator("#hero img")).toHaveAttribute("fetchpriority", "high");
  });

  test("loads without console errors or broken local requests", async ({ page, baseURL }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      // Requests to other hosts (the map) are blocked on purpose, so only local errors count.
      const source = message.location().url;
      if (message.type() === "error" && (!source || source.startsWith(baseURL ?? ""))) {
        problems.push(`${message.text()} (${source})`);
      }
    });
    page.on("response", (response) => {
      if (response.url().startsWith(baseURL ?? "") && response.status() >= 400) {
        problems.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.goto("/", { waitUntil: "networkidle" });
    // Visit every section so lazy images load too.
    for (const section of await page.locator("main > section[id]").all()) {
      await section.scrollIntoViewIfNeeded();
    }
    await page.waitForLoadState("networkidle");
    expect(problems).toEqual([]);
  });

  test("does not scroll sideways", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});

test.describe("navigation", () => {
  test("menu links take you to each section", async ({ page }) => {
    await page.goto("/");
    if (isMobile(page)) {
      await page.getByLabel("Abrir menu").click();
      const menu = page.getByRole("navigation", { name: "Menu", exact: true });
      await expect(menu).toBeVisible();
      await menu.getByRole("link", { name: "Contato" }).click();
      // Choosing a section closes the menu.
      await expect(menu).toBeHidden();
    } else {
      await page
        .getByRole("navigation", { name: "Menu principal" })
        .getByRole("link", { name: "Contato" })
        .click();
    }
    await expect(page).toHaveURL(/#contato$/);
    await expect(page.locator("#contato-title")).toBeInViewport();
  });

  test("header CTA shows on large screens only", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator("header").getByRole("link", { name: "Fale conosco" });
    if (isMobile(page)) await expect(cta).toBeHidden();
    else await expect(cta).toBeVisible();
  });

  test("Escape closes the mobile menu and returns focus", async ({ page }) => {
    test.skip(!isMobile(page), "The menu button only exists on small screens");
    await page.goto("/");
    const button = page.getByLabel("Abrir menu");
    await button.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Menu", exact: true })).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("the first Tab reaches the skip link", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });
});

test.describe("interactions", () => {
  test("FAQ answers open and close", async ({ page }) => {
    await page.goto("/");
    const question = page.locator("#faq summary").first();
    const answer = page.locator("#faq details").first().locator("p");
    await question.scrollIntoViewIfNeeded();
    await expect(answer).toBeHidden();
    await question.click();
    await expect(answer).toBeVisible();
    await question.click();
    await expect(answer).toBeHidden();
  });

  test("WhatsApp links open a chat with the business", async ({ page }) => {
    await page.goto("/");
    const fab = page.getByRole("link", { name: "Conversar no WhatsApp" });
    await expect(fab).toBeVisible();
    await expect(fab).toHaveAttribute("href", `https://wa.me/${fixture.business.contact.whatsapp}`);
    await expect(fab).toHaveAttribute("target", "_blank");
    await expect(fab).toHaveAttribute("rel", /noopener/);
    await expect(page.locator("#hero").getByRole("link", { name: "Fale conosco" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\//,
    );
  });

  test("the map loads only when the visitor gets close to it", async ({ page }) => {
    await page.goto("/");
    const map = page.locator("[data-map]");
    // A link to Google Maps works even before (or without) the embedded map.
    await expect(map.getByRole("link", { name: "Abrir no Google Maps" })).toHaveAttribute(
      "href",
      /^https:\/\/www\.google\.com\/maps\/search\//,
    );
    await expect(map.locator("iframe")).toHaveCount(0);
    await map.scrollIntoViewIfNeeded();
    const iframe = map.locator("iframe");
    await expect(iframe).toHaveCount(1);
    await expect(iframe).toHaveAttribute("src", /^https:\/\/www\.google\.com\/maps\?q=/);
    await expect(iframe).toHaveAttribute("title", /Mapa com a localização/);
  });
});

test.describe("door sign and opening hours", () => {
  const sign = (page: Page) => page.locator("[data-door-sign]");

  test("shows open with the closing time during business hours", async ({ page }) => {
    // Tuesday, 10:00 in São Paulo.
    await page.clock.setFixedTime(new Date("2026-10-20T10:00:00-03:00"));
    await page.goto("/");
    await expect(sign(page)).toBeVisible();
    await expect(sign(page)).toHaveAttribute("data-state", "open");
    await expect(sign(page)).toContainText("Aberto agora");
    await expect(sign(page)).toContainText("Fecha às 19:00");
    await expect(page.locator("[data-today-fact]")).toContainText("06:00 - 19:00");
    await expect(page.locator("tr[data-today]")).toContainText("Seg a Sex");
  });

  test("shows closed on Sunday and opens tomorrow", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-25T10:00:00-03:00"));
    await page.goto("/");
    await expect(sign(page)).toHaveAttribute("data-state", "closed");
    await expect(sign(page)).toContainText("Fechado agora");
    await expect(sign(page)).toContainText("Abre amanhã às 06:00");
    await expect(page.locator("tr[data-today]")).toContainText("Domingo");
  });

  test("skips the closed Sunday after Saturday closing", async ({ page }) => {
    // Saturday, 15:00: closed since 14:00, closed all Sunday.
    await page.clock.setFixedTime(new Date("2026-10-24T15:00:00-03:00"));
    await page.goto("/");
    await expect(sign(page)).toContainText("Abre segunda às 06:00");
    await expect(page.locator("[data-today-fact]")).toContainText("06:00 - 14:00");
  });

  test("uses the business time zone, not the visitor's", async ({ browser, baseURL }) => {
    // A visitor in Lisbon at 13:30 (09:30 in São Paulo) still sees the bakery open.
    const context = await browser.newContext({ timezoneId: "Europe/Lisbon" });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-20T12:30:00Z"));
    await page.goto(baseURL ?? "/");
    await expect(page.locator("[data-door-sign]")).toContainText("Fecha às 19:00");
    await context.close();
  });
});

test.describe("motion", () => {
  test("animates the page by default", async ({ page }) => {
    await page.goto("/");
    const count = await page.evaluate(() => document.getAnimations().length);
    expect(count).toBeGreaterThan(0);
  });

  test("respects reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => !(animation instanceof CSSTransition))
        .map((animation) => (animation as CSSAnimation).animationName),
    );
    expect(running).toEqual([]);
  });
});
