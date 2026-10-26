import type { Page } from "@playwright/test";

// WCAG 2 contrast check for every visible text on the page, in the page itself. It blends
// the text color (with the opacity of every ancestor, animations included) over the first
// opaque background behind it. Normal text needs 4.5:1; large text (24px, or 18.66px bold)
// needs 3:1. Canvases and images are not text and are not checked.

export interface ContrastIssue {
  text: string;
  ratio: number;
  required: number;
  fontSize: number;
}

export function findContrastIssues(page: Page): Promise<ContrastIssue[]> {
  return page.evaluate(() => {
    type Rgba = [number, number, number, number];
    const parse = (color: string): Rgba => {
      const match = color.match(/rgba?\(([^)]+)\)/);
      if (!match?.[1]) return [0, 0, 0, 0];
      const parts = match[1]
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    };
    const luminance = ([r, g, b]: Rgba) => {
      const channel = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => {
      const a = top[3];
      return [0, 1, 2]
        .map((i) => (top[i] as number) * a + (bottom[i] as number) * (1 - a))
        .concat(1) as Rgba;
    };
    const background = (element: Element): Rgba => {
      const layers: Rgba[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color[3] > 0) layers.push(color);
        if (color[3] >= 1) break;
      }
      let base: Rgba = [255, 255, 255, 1];
      for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i] as Rgba, base);
      return base;
    };
    const opacity = (element: Element) => {
      let value = 1;
      for (let node: Element | null = element; node; node = node.parentElement) {
        value *= Number(getComputedStyle(node).opacity);
      }
      return value;
    };

    const issues: ContrastIssue[] = [];
    const checked = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!element || checked.has(element) || !node.textContent?.trim()) continue;
      checked.add(element);
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const offscreen = box.bottom < 0 || box.top > window.innerHeight;
      if (!box.width || !box.height || offscreen || style.visibility === "hidden") continue;
      if (element.closest(".sr-only, [hidden], script, style, noscript")) continue;
      // Not entered yet (below the line where sections and stem questions come in): it is
      // not shown to the reader. motion.spec.ts checks that every one of them enters.
      if (element.closest('[data-entry="waiting"]')) continue;
      const behind = background(element);
      const own = parse(style.color);
      const text = over([own[0], own[1], own[2], own[3] * opacity(element)], behind);
      const l1 = luminance(text);
      const l2 = luminance(behind);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const fontSize = Number.parseFloat(style.fontSize);
      const large = fontSize >= 24 || (fontSize >= 18.66 && Number(style.fontWeight) >= 700);
      const required = large ? 3 : 4.5;
      if (ratio < required) {
        issues.push({
          text: node.textContent.trim().slice(0, 60),
          ratio: Math.round(ratio * 100) / 100,
          required,
          fontSize,
        });
      }
    }
    return issues;
  });
}

/**
 * Waits for the entrances that just started (a section fading in as it reaches the screen)
 * to finish, so the check sees the text as the reader settles on it. Endless loops and
 * animations driven by the scroll position are left alone: they are part of what is read.
 */
export function settleEntrances(page: Page): Promise<void> {
  return page.evaluate(async () => {
    const entering = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return (
        animation.playState === "running" &&
        animation.timeline === document.timeline &&
        timing?.iterations !== Number.POSITIVE_INFINITY
      );
    });
    const limit = new Promise((resolve) => setTimeout(resolve, 2000));
    await Promise.race([Promise.all(entering.map((animation) => animation.finished)), limit]);
  });
}

/** Scrolls through the whole page, checking each screen as a reader would see it. */
export async function findContrastIssuesWhileScrolling(page: Page): Promise<ContrastIssue[]> {
  const issues = new Map<string, ContrastIssue>();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => Math.round(window.innerHeight * 0.6));
  for (let y = 0; y <= height; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(150);
    await settleEntrances(page);
    for (const issue of await findContrastIssues(page)) issues.set(issue.text, issue);
  }
  return [...issues.values()];
}
