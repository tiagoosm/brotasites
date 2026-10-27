import AxeBuilder from "@axe-core/playwright";
import { variants } from "@brotasites/catalog";
import { expect, test } from "@playwright/test";

// Every variant in the catalog, across the matrix sites built by e2e/build-matrix.mjs (each with
// another personality and light mode): no sideways scroll, axe (WCAG A and AA, contrast
// included), no CSP violation and touch targets of 44 px, at 360 and 1280 px.

// Same count as the builder: one site per variant of the section that has the most. The
// builder's matrix.json says which variants each site uses; it is written after this file loads.
const perSection = new Map<string, number>();
for (const variant of variants)
  perSection.set(variant.section, (perSection.get(variant.section) ?? 0) + 1);
const sites = Array.from({ length: Math.max(...perSection.values()) }, (_, n) => ({
  path: `/${n}/`,
  n,
}));

const CSP =
  "default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

test.beforeEach(async ({ page, baseURL }) => {
  await page.route("**/*", async (route) => {
    if (
      !route
        .request()
        .url()
        .startsWith(baseURL ?? "")
    )
      return route.abort();
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    return route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": CSP },
    });
  });
});

for (const site of sites) {
  const name = `matrix site ${site.n}`;

  test(`${name}: no sideways scroll, no CSP violation`, async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text()))
        violations.push(message.text());
    });
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(site.path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
    }
    expect(violations).toEqual([]);
  });

  test(`${name}: passes axe at 360 and 1280 px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(site.path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`),
        `${width}px`,
      ).toEqual([]);
    }
  });

  test(`${name}: touch targets of 44 px`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(site.path);
    const small = await page
      .locator(
        "main a.btn, main summary, .channel, .contact-button, .footer-social a, .whatsapp-float, .header-cta",
      )
      .evaluateAll((items) =>
        items
          .filter((item) => item.getBoundingClientRect().height < 44)
          .map((item) => item.textContent?.trim()),
      );
    expect(small).toEqual([]);
  });
}
