// Generates the abstract placeholder photos used by the e2e fixture site.
// Run from the repo root: node packages/templates/e2e/fixture/make-images.mjs
import { mkdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// sharp comes with Astro; resolve it through Astro's real install path.
const astroPkg = realpathSync(join(here, "../../node_modules/astro/package.json"));
const sharp = createRequire(astroPkg)("sharp");

const assets = join(here, "assets");
mkdirSync(assets, { recursive: true });

function art(width, height, [a, b, c], seed) {
  const circles = Array.from({ length: 5 }, (_, i) => {
    const x = ((seed * 37 + i * 211) % 100) / 100;
    const y = ((seed * 53 + i * 127) % 100) / 100;
    const r = 0.18 + (((seed + i) * 17) % 30) / 100;
    return `<circle cx="${x * width}" cy="${y * height}" r="${r * Math.min(width, height)}" fill="${i % 2 ? b : c}" opacity="0.55"/>`;
  }).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <radialGradient id="g" cx="30%" cy="25%" r="90%">
        <stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${a}"/>
      </radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="${Math.round(width / 14)}"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <g filter="url(#blur)">${circles}</g>
  </svg>`);
}

const warm = ["#7C2D12", "#C2410C", "#FDE68A"];
const crust = ["#451A03", "#B45309", "#FCD34D"];
const flour = ["#A16207", "#FEF3C7", "#FFFBEB"];

const images = {
  "logo.png": [256, 256, ["#78350F", "#B45309", "#F59E0B"], 3],
  "hero.jpg": [1200, 1500, warm, 1],
  "sobre.jpg": [1600, 1000, crust, 2],
  "galeria-1.jpg": [1400, 1400, flour, 4],
  "galeria-2.jpg": [1200, 900, warm, 5],
  "galeria-3.jpg": [1200, 900, crust, 6],
};

for (const [name, [width, height, colors, seed]] of Object.entries(images)) {
  const image = sharp(art(width, height, colors, seed));
  const output = name.endsWith(".png") ? image.png() : image.jpeg({ quality: 72, mozjpeg: true });
  await output.toFile(join(assets, name));
}
console.log(`Imagens geradas em ${assets}`);
