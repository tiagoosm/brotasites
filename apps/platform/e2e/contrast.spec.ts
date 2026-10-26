import { expect, test } from "@playwright/test";
import { findContrastIssuesWhileScrolling } from "./support/contrast";

// Every text on the public pages meets WCAG AA contrast, at every point of the scroll and
// with or without motion.

for (const path of ["/", "/ajuda", "/criar/negocio"]) {
  test(`text on ${path} meets the minimum contrast`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(path);
    // Let the entrance animations settle.
    await page.waitForTimeout(1500);
    expect(await findContrastIssuesWhileScrolling(page)).toEqual([]);
  });
}

test("with reduced motion the home page also meets the minimum contrast", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  expect(await findContrastIssuesWhileScrolling(page)).toEqual([]);
  await context.close();
});
