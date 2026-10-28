import { serveDir } from "@brotasites/reviewer";
import { type Browser, chromium } from "@playwright/test";

// The direction cards show the real site: the first screen of each direction, built and
// photographed at phone and desktop widths.

export const CARD_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

export type Screenshotter = (distDir: string) => Promise<{ width: number; png: Buffer }[]>;

export function playwrightScreenshotter(
  options: { executablePath?: string } = {},
): Screenshotter & {
  close(): Promise<void>;
} {
  let browser: Browser | undefined;
  const shoot = async (distDir: string) => {
    const executablePath = options.executablePath ?? process.env.PW_CHROMIUM;
    browser ??= await chromium.launch(executablePath ? { executablePath } : {});
    const server = await serveDir(distDir);
    const shots: { width: number; png: Buffer }[] = [];
    try {
      for (const viewport of CARD_VIEWPORTS) {
        const context = await browser.newContext({
          viewport,
          reducedMotion: "reduce",
          locale: "pt-BR",
        });
        const origin = new URL(server.url).origin;
        await context.route("**/*", (route) =>
          route.request().url().startsWith(origin) ? route.continue() : route.abort(),
        );
        const page = await context.newPage();
        await page.goto(server.url, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        shots.push({ width: viewport.width, png: await page.screenshot({ type: "png" }) });
        await context.close();
      }
    } finally {
      await server.close();
    }
    return shots;
  };
  return Object.assign(shoot, {
    close: async () => {
      await browser?.close();
      browser = undefined;
    },
  });
}
