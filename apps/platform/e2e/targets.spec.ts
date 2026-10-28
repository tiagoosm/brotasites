import { expect, test } from "@playwright/test";
import { allBefore, padaria, SITE, siteRow, threeDirections, withSite } from "./support/supabase";
import { findSmallTargetsWhileScrolling } from "./support/targets";

// Every link, button and choice can be tapped on a 44 x 44px area that belongs to it.

const signedIn = [
  `/criar/${SITE}/negocio`,
  `/criar/${SITE}/marca`,
  `/criar/${SITE}/contato`,
  `/meus-sites/${SITE}`,
  "/admin",
  `/admin/sites/${SITE}`,
  "/admin/catalogo",
];

for (const path of ["/", "/ajuda", "/termos", "/privacidade", "/exemplo", ...signedIn]) {
  test(`touch targets on ${path} are at least 44px`, async ({ page, context }) => {
    test.setTimeout(60_000);
    if (signedIn.includes(path)) {
      await withSite(context, {
        site: siteRow("awaiting_direction_choice"),
        draft: padaria,
        completed: allBefore("endereco"),
        directions: threeDirections,
        admin: path.startsWith("/admin"),
      });
    }
    await page.goto(path);
    await page.waitForTimeout(1200);
    expect(await findSmallTargetsWhileScrolling(page)).toEqual([]);
  });
}
