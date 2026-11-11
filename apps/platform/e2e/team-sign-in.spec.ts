import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { findContrastIssues } from "./support/contrast";
import { findSmallTargets } from "./support/targets";

// The team's own sign-in (E33) at every size of the matrix: it fits, never scrolls sideways,
// stays still (CLS 0), and has no axe, contrast or target problem. Without an admin host (as in
// development and these tests) it opens at /entrar/equipe on the platform's address.

const sizes = [
  [360, 640],
  [390, 844],
  [768, 1024],
  [1280, 600],
  [1366, 650],
  [1440, 900],
] as const;

// biome-ignore lint/correctness/noEmptyPattern: Playwright reads the fixtures from this pattern
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "the sizes are set here");
});

for (const [width, height] of sizes) {
  test(`the team's sign-in at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      const store = window as unknown as { shifts: number };
      store.shifts = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        })[]) {
          if (!entry.hadRecentInput) store.shifts += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/entrar/equipe");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Área da equipe");
    await page.waitForTimeout(500);
    // No sideways scroll.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
    // The button is on screen without scrolling from 600px of height.
    if (height >= 600) await expect(page.getByRole("button", { name: "Entrar" })).toBeInViewport();
    expect(await page.evaluate(() => (window as unknown as { shifts: number }).shifts)).toBe(0);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).join(" | ")}`),
    ).toEqual([]);
    expect(await findContrastIssues(page)).toEqual([]);
    expect(await findSmallTargets(page)).toEqual([]);
  });
}
