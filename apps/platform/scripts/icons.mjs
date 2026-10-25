// Draws the app icons from the logo's sprout and saves them where the Next.js App Router
// picks them up by name (src/app): favicon.ico (16, 32, 48), icon.png (512) and
// apple-icon.png (180, opaque, as iOS requires). Run: node apps/platform/scripts/icons.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const app = (name) => fileURLToPath(new URL(`../src/app/${name}`, import.meta.url));

// The sprout from components/brand.tsx, on the Herbarium paper with a leaf-green ring.
const sprout = `
  <path d="M12 22V11" stroke="#2f7a4a" stroke-width="2" stroke-linecap="round"/>
  <path d="M12 13C12 8 8.5 5 3 5c0 5.5 3.5 8 9 8Z" fill="#2f7a4a"/>
  <path d="M12 11c0-4.5 3-7.5 9-7.5 0 5-3 7.5-9 7.5Z" fill="#2f7a4a" opacity=".65"/>`;

const tile = (size, { rounded }) => `<!doctype html><html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${rounded ? 7 : 0}" fill="#f7f8f3"/>
  <g transform="translate(4 3.5) scale(1)">${sprout}</g>
</svg></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(size, options) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(tile(size, options));
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

writeFileSync(app("icon.png"), await render(512, { rounded: true }));
writeFileSync(app("apple-icon.png"), await render(180, { rounded: false }));

// favicon.ico: an ICO container holding PNG images (supported by every current browser).
const sizes = [16, 32, 48];
const images = [];
for (const size of sizes) images.push(await render(size, { rounded: true }));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const entry = 6 + 16 * i;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt8(0, entry + 2);
  header.writeUInt8(0, entry + 3);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[i].length;
});
writeFileSync(app("favicon.ico"), Buffer.concat([header, ...images]));

await browser.close();
console.log("Salvos favicon.ico, icon.png e apple-icon.png em src/app");
