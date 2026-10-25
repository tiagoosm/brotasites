import { expect, test } from "@playwright/test";
import { findSmallTargetsWhileScrolling } from "./support/targets";

// Every link, button and choice can be tapped on a 44 x 44px area that belongs to it.

for (const path of ["/", "/criar/negocio"]) {
  test(`touch targets on ${path} are at least 44px`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(path);
    await page.waitForTimeout(1200);
    expect(await findSmallTargetsWhileScrolling(page)).toEqual([]);
  });
}
