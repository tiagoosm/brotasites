import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The 1.2 template (catalog identity, base variants, default motion) on the fixture site.

const fixture = JSON.parse(
  readFileSync(new URL("./fixture-v12/site-config.json", import.meta.url), "utf8"),
) as { sections: { id: string; enabled: boolean }[]; seo: { title: string } };

// The CSP the sites Worker sends (docs/security.md); the test serves the page with it.
const CSP =
  "default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

test.beforeEach(async ({ page, baseURL }) => {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith(baseURL ?? "")) return route.abort();
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    return route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": CSP },
    });
  });
});

test("renders the enabled sections in the client's order", async ({ page }) => {
  await page.goto("/");
  const expected = fixture.sections.filter((s) => s.enabled && s.id !== "hero").map((s) => s.id);
  const rendered = await page
    .locator("main > section[id]:not(#abertura)")
    .evaluateAll((sections) => sections.map((section) => section.id));
  expect(rendered).toEqual(expected);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page).toHaveTitle(fixture.seo.title);
});

test("runs under the sites' CSP with no external request", async ({ page }) => {
  const violations: string[] = [];
  const external: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });
  page.on("request", (request) => {
    if (!request.url().startsWith("http://localhost")) external.push(request.url());
  });
  await page.goto("/");
  await page.mouse.wheel(0, 20000);
  await page.waitForLoadState("networkidle");
  expect(violations).toEqual([]);
  expect(external).toEqual([]);
  const html = await page.content();
  expect(html).not.toMatch(/\sstyle="/);
  expect(html).not.toMatch(/<style[\s>]/);
  const inlineScripts = await page
    .locator("script:not([src])")
    .evaluateAll((scripts) => scripts.map((script) => script.getAttribute("type")));
  expect(inlineScripts.every((type) => type === "application/ld+json")).toBe(true);
});

test("ships at most 8 KB of JavaScript (gzip)", async ({ page, request }) => {
  await page.goto("/");
  const sources = await page
    .locator("script[src]")
    .evaluateAll((s) => s.map((x) => (x as HTMLScriptElement).src));
  let total = 0;
  for (const source of sources) total += gzipSync(await (await request.get(source)).body()).length;
  expect(total).toBeLessThanOrEqual(8 * 1024);
});

test("has no sideways scroll at 360, 768 and 1280 px", async ({ page }) => {
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
  }
});

test("passes axe (WCAG A and AA)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`),
  ).toEqual([]);
});

test("shows every word without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto("/");
  const hidden = await page
    .locator("[data-anim], [data-anim] > *, .word")
    .evaluateAll((items) => items.filter((item) => getComputedStyle(item).opacity === "0").length);
  expect(hidden).toBe(0);
  await expect(page.getByRole("link", { name: /WhatsApp/ }).first()).toBeVisible();
  await context.close();
});

test("shows everything at once with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const hidden = await page
    .locator("[data-anim], [data-anim] > *, .word")
    .evaluateAll((items) => items.filter((item) => getComputedStyle(item).opacity === "0").length);
  expect(hidden).toBe(0);
});

test("reveals sections once as they enter the screen", async ({ page }) => {
  await page.goto("/");
  const servicos = page.locator("#servicos .section-head");
  await expect(servicos).not.toHaveAttribute("data-anim-in", "");
  await servicos.scrollIntoViewIfNeeded();
  await expect(servicos).toHaveAttribute("data-anim-in", "");
  await expect(servicos).toHaveCSS("opacity", "1");
});

test("keeps touch targets at least 44 px tall", async ({ page }) => {
  await page.goto("/");
  const small = await page
    .locator("main a.btn, main summary, .channel, .footer-social a, .whatsapp-float, .header-cta")
    .evaluateAll((items) =>
      items
        .filter((item) => item.getBoundingClientRect().height < 44)
        .map((item) => item.textContent?.trim()),
    );
  expect(small).toEqual([]);
});

test("tells whether the business is open now and marks today", async ({ page }) => {
  // Monday 10:00 in Brasília.
  await page.clock.setFixedTime(new Date("2026-10-26T13:00:00Z"));
  await page.goto("/");
  await expect(page.locator("#contato [data-open-status]")).toHaveText(
    "Aberto agora · Fecha às 19:00",
  );
  await expect(page.locator('#contato [data-days="1,2,3,4,5"]')).toHaveAttribute("data-today", "");
});

test("serves its own fonts with their licenses", async ({ request }) => {
  const css = await (await request.get("/assets/site.css")).text();
  const fonts = [...css.matchAll(/url\("\.\.\/fonts\/([^"]+)"\)/g)].map((m) => m[1]);
  expect(fonts.length).toBeGreaterThan(0);
  for (const font of fonts) {
    expect((await request.get(`/fonts/${font}`)).status()).toBe(200);
    expect((await request.get(`/fonts/${font?.split("/")[0]}/OFL.txt`)).status()).toBe(200);
  }
});
