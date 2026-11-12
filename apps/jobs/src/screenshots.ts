import { KEEP_NAMES_SHIM, serveDir } from "@brotasites/reviewer";
import { type Browser, chromium } from "@playwright/test";

// The direction cards show the real site: the first screen of each direction, built and
// photographed at phone and desktop widths.

export const CARD_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

/**
 * Chromium in a container (E37): /dev/shm is small there, and Chromium falls back to /tmp with
 * this flag instead of crashing or swelling. The sandbox stays on.
 */
export const CHROMIUM_ARGS = ["--disable-dev-shm-usage"];

export type Screenshotter = (distDir: string) => Promise<{ width: number; png: Buffer }[]>;

export function playwrightScreenshotter(
  options: { executablePath?: string } = {},
): Screenshotter & {
  close(): Promise<void>;
} {
  // One browser for the whole run, launched on first use; one short-lived context per shot,
  // taken one after the other (E37: memory).
  let browser: Browser | undefined;
  const shoot = async (distDir: string) => {
    const executablePath = options.executablePath ?? process.env.PW_CHROMIUM;
    browser ??= await chromium.launch({
      args: CHROMIUM_ARGS,
      ...(executablePath ? { executablePath } : {}),
    });
    const server = await serveDir(distDir);
    const shots: { width: number; png: Buffer }[] = [];
    try {
      for (const viewport of CARD_VIEWPORTS) {
        const context = await browser.newContext({
          viewport,
          reducedMotion: "reduce",
          locale: "pt-BR",
        });
        try {
          // E39: the bundled page.evaluate below needs __name in the page.
          await context.addInitScript(KEEP_NAMES_SHIM);
          const origin = new URL(server.url).origin;
          await context.route("**/*", (route) =>
            route.request().url().startsWith(origin) ? route.continue() : route.abort(),
          );
          const page = await context.newPage();
          await page.goto(server.url, { waitUntil: "load" });
          await page.evaluate(() => document.fonts.ready);
          shots.push({ width: viewport.width, png: await page.screenshot({ type: "png" }) });
        } finally {
          await context.close();
        }
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
