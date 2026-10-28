import { expect, test } from "@playwright/test";
import { findContrastIssuesWhileScrolling } from "./support/contrast";
import { allBefore, padaria, SITE, siteRow, threeDirections, withSite } from "./support/supabase";

// Every text on the public pages meets WCAG AA contrast, at every point of the scroll and
// with or without motion.

const signedIn = [`/criar/${SITE}/negocio`, `/criar/${SITE}/contato`, `/meus-sites/${SITE}`];

for (const path of ["/", "/ajuda", ...signedIn]) {
  test(`text on ${path} meets the minimum contrast`, async ({ page, context }) => {
    test.setTimeout(60_000);
    if (signedIn.includes(path)) {
      await withSite(context, {
        site: siteRow("awaiting_direction_choice"),
        draft: padaria,
        completed: allBefore("endereco"),
        directions: threeDirections,
      });
    }
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
