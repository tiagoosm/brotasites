import type { Page } from "@playwright/test";

// Touch targets of at least 44 x 44px: for each link, button or choice on screen, the middle
// of each side of a 44px square centered on it must reach that same element (sides, not
// corners, since browsers do not count the cut-off corners of rounded buttons). That checks the
// size (including areas grown by the touch-target utility) and that targets do not overlap.

export interface SmallTarget {
  name: string;
  hitBy: string;
}

export function findSmallTargets(page: Page): Promise<SmallTarget[]> {
  return page.evaluate(() => {
    const HALF = 21;
    const selector = 'a[href], button, summary, label:has(> input[type="radio"])';
    const small: SmallTarget[] = [];
    // Sticky headers and footers cover different targets at each scroll position.
    const onOverlay = (node: Element, target: Element) => {
      for (let n: Element | null = node; n; n = n.parentElement) {
        if (n.contains(target)) return false;
        const position = getComputedStyle(n).position;
        if (position === "sticky" || position === "fixed") return true;
      }
      return false;
    };
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (element.closest('[aria-hidden="true"], .sr-only, [hidden]')) continue;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!box.width || !box.height || style.visibility === "hidden") continue;
      if (box.bottom > window.innerHeight || box.top < 0) continue;
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      // Its square runs past the screen edge: nothing can be hit there, so it is checked at
      // the next scroll position (steps are half a screen).
      if (cy - HALF < 0 || cy + HALF > window.innerHeight) continue;
      // Covered right now (e.g. under a sticky header or footer): checked at another scroll.
      const center = document.elementFromPoint(cx, cy);
      if (!center || !(center === element || element.contains(center))) continue;
      for (const [dx, dy] of [
        [-HALF, 0],
        [HALF, 0],
        [0, -HALF],
        [0, HALF],
      ] as const) {
        const hit = document.elementFromPoint(cx + dx, cy + dy);
        if (hit && onOverlay(hit, element)) break;
        if (!hit || !(hit === element || element.contains(hit))) {
          small.push({
            name: (element.textContent || element.getAttribute("aria-label") || "")
              .trim()
              .slice(0, 40),
            hitBy: hit
              ? `${hit.tagName.toLowerCase()} "${(hit.textContent ?? "").trim().slice(0, 24)}" at ${dx},${dy} (box ${Math.round(box.width)}x${Math.round(box.height)})`
              : "nothing",
          });
          break;
        }
      }
    }
    return small;
  });
}

/** Checks each screen of the page, top to bottom. */
export async function findSmallTargetsWhileScrolling(page: Page): Promise<SmallTarget[]> {
  const found = new Map<string, SmallTarget>();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => Math.round(window.innerHeight * 0.5));
  for (let y = 0; y <= height; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
    // Sizes are checked in the settled layout: entrances (which come back on every scroll,
    // E18) move elements for a moment. Endless loops (the glow's turn, the leaves' sway) are
    // not waited for.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              // Time-based and running: not the stem's ink (driven by the scroll), not a loop.
              animation.timeline === document.timeline &&
              animation.playState === "running" &&
              animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY,
          )
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
    );
    for (const target of await findSmallTargets(page)) found.set(target.name, target);
  }
  return [...found.values()];
}
