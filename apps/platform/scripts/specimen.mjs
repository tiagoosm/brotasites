// Renders the example site (docs/site-config.example.json) on the preview server and saves
// the screenshots used by the home page's specimen. Run with the preview server up:
//   pnpm --filter @brotasites/preview dev
//   node apps/platform/scripts/specimen.mjs
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const PREVIEW = process.env.PREVIEW_URL ?? "http://localhost:4400";
const out = new URL("../public/specimen/", import.meta.url);
const shots = [
  { name: "desktop.png", viewport: { width: 1280, height: 860 }, scale: 1.5 },
  { name: "phone.png", viewport: { width: 390, height: 780 }, scale: 2 },
];

const browser = await chromium.launch();
for (const shot of shots) {
  const page = await browser.newPage({ viewport: shot.viewport, deviceScaleFactor: shot.scale });
  await page.goto(`${PREVIEW}/render`, { waitUntil: "networkidle" });
  // Let the entrance animations finish before taking the picture.
  await page.waitForTimeout(2500);
  await page.screenshot({ path: fileURLToPath(new URL(shot.name, out)) });
  await page.close();
  console.log(`Salvo ${shot.name}`);
}
await browser.close();
