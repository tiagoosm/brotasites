import { expect, test } from "@playwright/test";

// The help page's table of contents scrolls smoothly to the chosen topic (2026-11-05), the same
// way the home page's section links do (E18): positions on the way, the topic's title focused,
// the "#" in the address.

test("a topic of the help page is reached with the smooth scroll", async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/ajuda");
  await page.waitForLoadState("networkidle");
  const toc = page.getByRole("navigation", { name: "Nesta página" });
  // On phones the table of contents is folded under "Nesta página".
  const fold = toc.locator("summary");
  if (await fold.isVisible()) await fold.click();
  const positions: number[] = [];
  const sample = setInterval(() => {
    page
      .evaluate(() => window.scrollY)
      .then(
        (y) => positions.push(y),
        () => {},
      );
  }, 40);
  await toc.getByRole("link", { name: "Fale com a gente" }).locator("visible=true").click();
  await expect(page.locator("#contato-titulo")).toBeFocused({ timeout: 5000 });
  clearInterval(sample);
  await expect(page).toHaveURL(/\/ajuda#contato$/);
  const end = await page.evaluate(() => window.scrollY);
  expect(end).toBeGreaterThan(200);
  // Smooth: the window passed through positions on the way, it did not jump.
  expect(positions.some((y) => y > 0 && y < end - 50)).toBe(true);
});
