// Writes dist/specimen/ with an HTML page showing every font pair, palettes per personality,
// ornaments, dividers, patterns and photo treatments. Run `pnpm --filter @brotasites/catalog
// specimen` and open dist/specimen/index.html. For people reviewing the catalog, not for sites.
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import {
  buildOrnament,
  createRandom,
  dividerSvg,
  dividers,
  fontFaceCss,
  fontPairs,
  fontStack,
  fontsDir,
  GRAIN_SVG,
  generatePalette,
  gradientBackground,
  ornamentIds,
  ornamentSvg,
  patterns,
  personalities,
  personalityPalettes,
} from "../dist/index.js";

const out = new URL("../dist/specimen/", import.meta.url);
mkdirSync(new URL("assets/", out), { recursive: true });
cpSync(fontsDir, new URL("fonts/", out).pathname, { recursive: true });
writeFileSync(new URL("assets/grain.svg", out), GRAIN_SVG);

const esc = (text) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const faces = fontPairs.map((pair) => fontFaceCss(pair, "fonts/")).join("\n");

const pairs = fontPairs
  .map(
    (pair) => `<article class="card">
  <p class="meta">${pair.id} · ${pair.personalities.join(", ")}</p>
  <p style="font-family:${esc(fontStack(pair.label))};font-size:1.4rem;margin:0;color:#B45309">feito com carinho</p>
  <h2 style="font-family:${esc(fontStack(pair.heading))};font-weight:${pair.headingWeight};font-size:2.6rem;line-height:1;margin:.2em 0">Pão quentinho <em>todo</em> dia</h2>
  <p style="font-family:${esc(fontStack(pair.body))};font-size:1.05rem;line-height:1.6;margin:0">Padaria de bairro em Santa Rita do Sapucaí, com fermentação natural, bolos por encomenda e café da manhã. Ação, coração, pães, maçã, avó.</p>
</article>`,
  )
  .join("\n");

const palettes = personalities
  .flatMap((personality) =>
    personalityPalettes[personality].modes.flatMap((mode) =>
      [0, 1, 2].map((round) => {
        const random = createRandom(`${personality}-${mode}-${round}`);
        const p = generatePalette({
          personality,
          mode,
          random,
          brandColors: round === 0 ? ["#B45309"] : [],
        });
        const g = gradientBackground(random, p);
        return `<article class="swatch" style="background:${g.background};color:${p.text}">
  <p class="meta" style="color:${p.textMuted}">${personality} · ${mode}${round === 0 ? " · marca #B45309" : ""}</p>
  <h3 style="margin:.2em 0">Título no fundo</h3>
  <p style="color:${p.textMuted};margin:0 0 .8em">Texto secundário legível.</p>
  <span class="btn" style="background:${p.primary};color:${p.onPrimary}">Pedir pelo WhatsApp</span>
  <span class="dot" style="background:${p.accent}"></span>
  <div class="strip">${Object.entries(p)
    .map(([k, v]) => `<span title="${k} ${v}" style="background:${v}"></span>`)
    .join("")}</div>
</article>`;
      }),
    ),
  )
  .join("\n");

const ornaments = ornamentIds
  .map(
    (id) =>
      `<figure class="orn">${ornamentSvg(buildOrnament(id, createRandom(id)))}<figcaption>${id}</figcaption></figure>`,
  )
  .join("");
const dividerRows = dividers
  .map(
    (d) =>
      `<div class="div-row"><span>${d.id}</span><div class="div-box">${dividerSvg(d)}</div></div>`,
  )
  .join("");
const patternRows = patterns
  .map((p) => `<div class="pat" style="background:${p.background}, #FFFBEB">${p.id}</div>`)
  .join("");

writeFileSync(
  new URL("index.html", out),
  `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Catálogo BrotaSites</title>
<style>${faces}
body{margin:0;padding:24px;font-family:system-ui;background:#f4f1ea;color:#1c1917;--pattern-color:rgb(28 25 23 / .12)}
h1{margin:0 0 16px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-bottom:40px}
.card,.swatch{background:#fff;border-radius:12px;padding:20px;position:relative;overflow:hidden}
.meta{font:12px/1.4 ui-monospace,monospace;margin:0 0 8px;opacity:.8}
.btn{display:inline-block;padding:.7em 1.2em;border-radius:999px;font-weight:600}
.dot{display:inline-block;width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-left:8px}
.strip{display:flex;margin-top:14px;height:16px;border-radius:4px;overflow:hidden}.strip span{flex:1}
.orn{margin:0;background:#fff;border-radius:12px;padding:12px;text-align:center;color:#B45309}.orn svg{width:100%;height:110px}
.orn figcaption{font:12px ui-monospace,monospace;color:#555}
.div-row{display:grid;grid-template-columns:120px 1fr;align-items:start;gap:12px;margin-bottom:12px;font:12px ui-monospace,monospace}
.div-box{background:#FFFBEB;color:#78350F;height:110px}.div-box svg{display:block;width:100%;height:auto;max-height:90px}
.pat{height:120px;border-radius:12px;padding:8px;font:12px ui-monospace,monospace}
</style>
<h1>Catálogo BrotaSites</h1>
<h2>Pares de fontes</h2><section class="grid">${pairs}</section>
<h2>Paletas (fundo com gradiente e granulação)</h2><section class="grid">${palettes}</section>
<h2>Ornamentos</h2><section class="grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">${ornaments}</section>
<h2>Divisores</h2><section>${dividerRows}</section>
<h2>Padrões</h2><section class="grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${patternRows}</section>
</html>`,
);
console.log("Wrote dist/specimen/index.html");
