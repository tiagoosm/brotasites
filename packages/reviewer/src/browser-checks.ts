import AxeBuilder from "@axe-core/playwright";
import { type Browser, chromium, type Page } from "@playwright/test";
import type { Finding } from "./findings.js";
import { serveDir } from "./serve.js";

// Checks in a real browser (docs/ai-and-reviewer.md, Reviewer 1): content past the screen edge at
// 360, 768 and 1280 px, accessibility (axe, WCAG 2.1 AA), 44 px touch targets, words broken in
// the middle of a heading or other large text, text cut off by its box, failed and outside
// requests, and content hidden when the visitor asks for reduced motion. Every request that does
// not go to the site itself is blocked and reported. Also returns the screenshots the reviewer
// agent looks at.

export const REVIEW_WIDTHS = [360, 768, 1280] as const;
const MIN_TARGET = 44;

export interface BrowserCheckOptions {
  base?: string;
  widths?: readonly number[];
  /** Widths to take full-page screenshots at, for the agent. */
  screenshotWidths?: readonly number[];
  /** A Chromium binary; PW_CHROMIUM in the environment otherwise, else Playwright's own. */
  executablePath?: string;
  /** An open browser to reuse across sites. */
  browser?: Browser;
}

export interface Screenshot {
  width: number;
  png: Buffer;
}

export interface BrowserResult {
  findings: Finding[];
  screenshots: Screenshot[];
}

/** Section of an element: the section id, "hero" for the opening, "page" for header and footer. */
const sectionScript = `
  window.__sectionOf = (el) => {
    const section = el.closest("section[id]");
    if (!section) return "page";
    return section.id === "abertura" ? "hero" : section.id;
  };
`;

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    for (
      let y = 0;
      y < document.documentElement.scrollHeight;
      y += Math.max(200, innerHeight * 0.8)
    ) {
      scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    scrollTo(0, 0);
  });
}

type PageFinding = Omit<Finding, "width">;

async function layoutFindings(page: Page): Promise<PageFinding[]> {
  return page.evaluate((min) => {
    const sectionOf = (window as unknown as { __sectionOf: (el: Element) => string }).__sectionOf;
    const out: {
      check: string;
      severity: "low" | "medium" | "high";
      where: string;
      message: string;
    }[] = [];
    const seen = new Set<string>();
    const push = (item: (typeof out)[number]) => {
      const key = `${item.check}|${item.where}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(item);
    };
    const visible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return (
        rect.width >= 2 &&
        rect.height >= 2 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };
    const describe = (el: Element) =>
      (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);

    // Content past the edge of the screen: it scrolls sideways or, where the page clips it
    // (body and sections use overflow-x: clip), it is cut off. Decorative pieces are
    // aria-hidden and may bleed out on purpose.
    for (const el of document.body.querySelectorAll("*")) {
      if (!visible(el) || el.closest("[aria-hidden=true]")) continue;
      const ownText = [...el.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim(),
      );
      if (!ownText && !["IMG", "PICTURE", "VIDEO", "svg", "BUTTON", "A"].includes(el.tagName))
        continue;
      const rect = el.getBoundingClientRect();
      if (rect.right > innerWidth + 1 || rect.left < -1) {
        push({
          check: "overflow",
          severity: "high",
          where: sectionOf(el),
          message: `Conteúdo passa da borda da tela (${el.tagName.toLowerCase()}: "${describe(el)}").`,
        });
      }
    }

    // Text cut off by its own box.
    for (const el of document.body.querySelectorAll(
      "h1,h2,h3,h4,p,li,a,button,summary,dt,dd,span,strong",
    )) {
      if (!visible(el) || !(el.textContent ?? "").trim()) continue;
      const style = getComputedStyle(el);
      const clips =
        /(hidden|clip)/.test(style.overflowX + style.overflowY) ||
        style.textOverflow === "ellipsis" ||
        style.getPropertyValue("-webkit-line-clamp") !== "none";
      if (!clips) continue;
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2) {
        push({
          check: "cut-off-text",
          severity: "medium",
          where: sectionOf(el),
          message: `Texto cortado: "${describe(el)}".`,
        });
      }
    }

    // A word broken in the middle of a heading or of other large text (a title too large for its
    // column, in a browser without Portuguese hyphenation). Breaks at a hyphen the word already
    // has are fine.
    const words = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = words.nextNode(); node; node = words.nextNode()) {
      const parent = node.parentElement;
      if (!parent || !visible(parent) || parent.closest("[aria-hidden=true],script,style"))
        continue;
      const large =
        parent.closest("h1,h2,h3") || Number.parseFloat(getComputedStyle(parent).fontSize) >= 28;
      if (!large) continue;
      const text = node.textContent ?? "";
      for (const match of text.matchAll(/[^\s\-\u2010-\u2014]{4,}/g)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
        if (tops.size > 1) {
          push({
            check: "broken-word",
            severity: "medium",
            where: sectionOf(parent),
            message: `Palavra quebrada no meio: "${match[0]}".`,
          });
        }
      }
    }

    // Touch targets: buttons and links that stand alone must be at least 44 x 44 px.
    for (const el of document.body.querySelectorAll(
      "a[href],button,summary,[role=button],input,select",
    )) {
      if (!visible(el)) continue;
      const style = getComputedStyle(el);
      // Links inside a sentence are exempt (WCAG 2.5.8, inline).
      if (style.display === "inline" && el.parentElement?.closest("p,li,dd,blockquote")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < min - 0.5 || rect.height < min - 0.5) {
        push({
          check: "touch-target",
          severity: "medium",
          where: sectionOf(el),
          message: `Área de toque de ${Math.round(rect.width)}×${Math.round(rect.height)} px: "${describe(el) || el.getAttribute("aria-label") || el.tagName.toLowerCase()}".`,
        });
      }
    }
    return out as {
      check: string;
      severity: "low" | "medium" | "high";
      where: Finding["where"];
      message: string;
    }[];
  }, MIN_TARGET);
}

async function hiddenContent(page: Page): Promise<PageFinding[]> {
  return page.evaluate(() => {
    const sectionOf = (window as unknown as { __sectionOf: (el: Element) => string }).__sectionOf;
    const hidden: { check: string; severity: "high"; where: string; message: string }[] = [];
    const seen = new Set<string>();
    for (const el of document.querySelectorAll("main *")) {
      if (!(el.textContent ?? "").trim() && el.tagName !== "IMG") continue;
      const style = getComputedStyle(el);
      if (Number(style.opacity) < 0.05 || style.visibility === "hidden") {
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const where = sectionOf(el);
        if (seen.has(where)) continue;
        seen.add(where);
        hidden.push({
          check: "reduced-motion",
          severity: "high",
          where,
          message: "Com movimento reduzido, parte do conteúdo continua invisível.",
        });
      }
    }
    return hidden as unknown as PageFinding[];
  });
}

export async function checkInBrowser(
  distDir: string,
  options: BrowserCheckOptions = {},
): Promise<BrowserResult> {
  const server = await serveDir(distDir, options.base ?? "/");
  const own = !options.browser;
  const executablePath = options.executablePath ?? process.env.PW_CHROMIUM;
  const browser =
    options.browser ?? (await chromium.launch(executablePath ? { executablePath } : {}));
  const findings: Finding[] = [];
  const screenshots: Screenshot[] = [];
  const origin = new URL(server.url).origin;
  try {
    for (const width of options.widths ?? REVIEW_WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
      });
      const outside = new Set<string>();
      const broken = new Set<string>();
      await context.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith(origin)) return route.continue();
        outside.add(url);
        return route.abort();
      });
      const page = await context.newPage();
      await page.addInitScript(sectionScript);
      page.on("response", (response) => {
        if (response.status() >= 400)
          broken.add(`${response.status()} ${response.url().slice(origin.length)}`);
      });
      page.on("requestfailed", (request) => {
        if (request.url().startsWith(origin))
          broken.add(`falhou ${request.url().slice(origin.length)}`);
      });
      await page.goto(server.url, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await scrollThrough(page);
      await page.waitForLoadState("networkidle");

      for (const item of await layoutFindings(page)) findings.push({ ...item, width });
      for (const item of await hiddenContent(page)) findings.push({ ...item, width });

      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      for (const violation of axe.violations) {
        const where = await page
          .locator(violation.nodes[0]?.target.join(" ") ?? "body")
          .first()
          .evaluate((el) =>
            (window as unknown as { __sectionOf: (el: Element) => string }).__sectionOf(el),
          )
          .catch(() => "page");
        findings.push({
          check: `axe:${violation.id}`,
          severity:
            violation.impact === "critical" || violation.impact === "serious" ? "high" : "medium",
          where: where as Finding["where"],
          width,
          message: `Acessibilidade: ${violation.help} (${violation.nodes.length} elemento(s)).`,
        });
      }

      for (const url of outside) {
        findings.push({
          check: "external-request",
          severity: "high",
          security: true,
          where: "page",
          width,
          message: `A página tentou carregar ${url.slice(0, 100)}.`,
        });
      }
      for (const item of broken) {
        findings.push({
          check: "broken-request",
          severity: "high",
          where: "page",
          width,
          message: `Requisição com erro: ${item}.`,
        });
      }

      if ((options.screenshotWidths ?? [360, 1280]).includes(width)) {
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        screenshots.push({
          width,
          png: await page.screenshot({ fullPage: height <= 7000, type: "png" }),
        });
      }
      await context.close();
    }
  } finally {
    if (own) await browser.close();
    await server.close();
  }
  return { findings: dedupe(findings), screenshots };
}

/** One finding per check and place, keeping the widths it happened at in the message. */
function dedupe(findings: Finding[]): Finding[] {
  const byKey = new Map<string, Finding & { widths: number[] }>();
  for (const finding of findings) {
    const key = `${finding.check}|${finding.where}|${finding.message}`;
    const existing = byKey.get(key);
    if (existing) {
      if (finding.width) existing.widths.push(finding.width);
    } else {
      byKey.set(key, { ...finding, widths: finding.width ? [finding.width] : [] });
    }
  }
  return [...byKey.values()].map(({ widths, ...finding }) => ({
    ...finding,
    width: widths[0],
    message: widths.length > 1 ? `${finding.message} (${widths.join(", ")} px)` : finding.message,
  }));
}
