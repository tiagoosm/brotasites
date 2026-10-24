// Draws the share image (Open Graph) in the Herbarium style and saves it as
// src/app/opengraph-image.png. Run: node apps/platform/scripts/og-image.mjs
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Hanken+Grotesk:wght@500&family=IBM+Plex+Mono:wght@500&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #f7f8f3; color: #14241b; font-family: "Hanken Grotesk"; position: relative; overflow: hidden; }
  .sheet { position: absolute; inset: 40px; border: 2px solid #d7ddd2; border-radius: 6px; background: #fff; padding: 72px 80px; }
  .brand { display: flex; align-items: center; gap: 14px; font-family: "Young Serif"; font-size: 34px; }
  h1 { font-family: "Young Serif"; font-weight: 400; font-size: 92px; line-height: 0.98; letter-spacing: -0.02em; margin-top: 62px; }
  h1 span { color: #2f5d45; display: block; }
  .tag { position: absolute; left: 80px; bottom: 64px; font-family: "IBM Plex Mono"; font-size: 20px; letter-spacing: 0.08em; text-transform: uppercase; color: #2f5d45; }
  svg.stem { position: absolute; right: 120px; top: 70px; }
</style></head><body>
<div class="sheet">
  <div class="brand"><svg viewBox="0 0 24 24" width="40" height="40" fill="#2f7a4a"><path d="M12 22V11" stroke="#2f7a4a" stroke-width="2" stroke-linecap="round"/><path d="M12 13C12 8 8.5 5 3 5c0 5.5 3.5 8 9 8Z"/><path d="M12 11c0-4.5 3-7.5 9-7.5 0 5-3 7.5-9 7.5Z" opacity=".65"/></svg>BrotaSites</div>
  <h1>Sete perguntas<span>e seu site pronto.</span></h1>
  <p class="tag">Criar é grátis · Sem código</p>
  <svg class="stem" width="180" height="470" viewBox="0 0 180 470" fill="none">
    <path d="M90 470 C 70 400, 110 330, 90 260 S 70 120, 90 40" stroke="#2f5d45" stroke-width="4" stroke-linecap="round"/>
    <g fill="#e2efe4" stroke="#2f5d45" stroke-width="3" stroke-linejoin="round">
      <path d="M92 380c18-22 52-24 74-6-22 18-52 22-74 6Z"/>
      <path d="M88 290c-18-22-52-24-74-6 22 18 52 22 74 6Z"/>
      <path d="M92 200c18-22 52-24 74-6-22 18-52 22-74 6Z"/>
      <path d="M88 115c-18-22-52-24-74-6 22 18 52 22 74 6Z"/>
    </g>
    <circle cx="90" cy="36" r="11" fill="#e2b23c"/>
  </svg>
</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({
  path: fileURLToPath(new URL("../src/app/opengraph-image.png", import.meta.url)),
});
await browser.close();
console.log("Salvo src/app/opengraph-image.png");
