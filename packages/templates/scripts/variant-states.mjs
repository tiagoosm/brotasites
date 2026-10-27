// Renders variants in the four mandatory states (docs/art-direction.md): good photo, weak photo
// (small and badly framed), no photo and long text, at 360 and 1280 px, and writes one picture
// per section, state and width plus an index.html to review them side by side.
//
//   node scripts/variant-states.mjs --out /tmp/states --hero hero-feast --sobre sobre-manifesto \
//     --servicos servicos-menu [--faq faq-split ...] [--personality robusto] [--mode dark]
// Any section id is a flag; its value is the variant to render.
//
// Uses the 1.2 e2e fixture (Padaria do Zé). Set PW_CHROMIUM to use a specific Chromium binary.
import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compatibleFontPairs, createRandom, generatePalette } from "@brotasites/catalog";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, list) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), list[index + 1]]);
    return pairs;
  }, []),
);
const out = resolve(args.out ?? join(root, "dist-states"));
const sectionIds = [
  "hero",
  "sobre",
  "servicos",
  "como-funciona",
  "diferenciais",
  "galeria",
  "depoimentos",
  "faq",
  "cta-final",
  "contato",
];
const sections = sectionIds.filter((id) => args[id]);
const fixtureDir = join(root, "e2e/fixture-v12");
const base = JSON.parse(readFileSync(join(fixtureDir, "site-config.json"), "utf8"));
const sharp = createRequire(realpathSync(join(root, "node_modules/astro/package.json")))("sharp");

function configFor(state) {
  const config = structuredClone(base);
  const identity = config.design.identity;
  if (args.hero) identity.heroVariant = args.hero;
  for (const id of sectionIds.slice(1)) if (args[id]) identity.sectionVariants[id] = args[id];
  if (args.personality) {
    identity.personality = args.personality;
    identity.fontPair = compatibleFontPairs(args.personality)[0].id;
    identity.palette = generatePalette({
      personality: args.personality,
      mode: args.mode,
      random: createRandom(`${args.personality}|${args.mode}`),
      brandColors: config.brand.brandColors,
    });
  }
  if (state === "long") {
    const name = "Panificadora e Confeitaria Artesanal Família Oliveira dos Santos de Santa Rita";
    config.business.name = name.slice(0, 80);
    config.business.description = "Padaria de bairro com pães de fermentação natural, "
      .repeat(10)
      .slice(0, 500);
    const hero = config.sections.find((s) => s.id === "hero");
    hero.content.title =
      "Pão de fermentação natural, bolos caseiros e café passado na hora todos os dias".slice(
        0,
        80,
      );
    hero.content.subtitle =
      "Desde 1998 na Rua das Flores, no Centro de Santa Rita do Sapucaí, com pão saindo do forno às seis da manhã, bolos por encomenda para aniversários e uma mesa de café que vai até a hora do almoço.".slice(
        0,
        200,
      );
    const sobre = config.sections.find((s) => s.id === "sobre");
    sobre.content.text = "A Padaria do Zé abriu as portas em 1998, na Rua das Flores. "
      .repeat(14)
      .slice(0, 800)
      .trim();
    const servicos = config.sections.find((s) => s.id === "servicos");
    servicos.content.items = Array.from({ length: 9 }, (_, i) => ({
      name: `Pão de fermentação natural com azeitonas número ${i + 1}`.slice(0, 50),
      description:
        "Massa de fermentação lenta, casca crocante e miolo macio, assado todas as manhãs no forno de pedra e vendido inteiro ou em fatias, quentinho, até acabar.".slice(
          0,
          200,
        ),
      price: `R$ ${12 + i},90`,
      icon: ["bread", "cake", "coffee"][i % 3],
    }));
  }
  return config;
}

async function writeAssets(state, dir) {
  if (state === "none") return;
  mkdirSync(join(dir, "assets"), { recursive: true });
  for (const file of readdirSync(join(fixtureDir, "assets"))) {
    const from = join(fixtureDir, "assets", file);
    if (state !== "weak" || file.endsWith(".png")) {
      cpSync(from, join(dir, "assets", file));
      continue;
    }
    // Weak: small, soft and cropped off-center, like a quick phone photo.
    const meta = await sharp(from).metadata();
    await sharp(from)
      .extract({
        left: Math.round(meta.width * 0.35),
        top: 0,
        width: Math.round(meta.width * 0.6),
        height: Math.round(meta.height * 0.7),
      })
      .resize({ width: 420 })
      .blur(1.2)
      .jpeg({ quality: 35 })
      .toFile(join(dir, "assets", file));
  }
}

const states = ["good", "weak", "none", "long"];
rmSync(out, { recursive: true, force: true });
const pictures = [];
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
/** A free port, so a server left over from an earlier run never answers for this one. */
function freePort() {
  return new Promise((resolvePort) => {
    const probe = createServer().listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

for (const state of states) {
  const siteDir = join(out, state, "site");
  mkdirSync(siteDir, { recursive: true });
  writeFileSync(join(siteDir, "site-config.json"), JSON.stringify(configFor(state), null, 2));
  await writeAssets(state, siteDir);
  const dist = join(out, state, "dist");
  const build = spawnSync("pnpm", ["exec", "astro", "build", "--outDir", dist], {
    cwd: root,
    env: {
      ...process.env,
      BROTASITES_CONFIG: join(siteDir, "site-config.json"),
      ASTRO_TELEMETRY_DISABLED: "1",
    },
    encoding: "utf8",
  });
  if (build.status !== 0)
    throw new Error(`Build failed for ${state}:\n${build.stdout}\n${build.stderr}`);
  const port = await freePort();
  const server = spawn("node", [join(root, "e2e/serve.mjs"), dist, String(port)], {
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 400));
  for (const width of [360, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    for (const section of sections) {
      const selector = section === "hero" ? "#abertura" : `#${section}`;
      const file = join(out, `${section}-${state}-${width}.png`);
      // A gallery with no photos is left out of the page: nothing to picture.
      if ((await page.locator(selector).count()) === 0) continue;
      await page.locator(selector).screenshot({ path: file });
      pictures.push({ section, state, width, file, overflow });
    }
    await page.close();
  }
  server.kill();
}
await browser.close();

const rows = sections
  .map(
    (section) =>
      `<h2>${section}: ${args[section]}</h2><div class="row">${states
        .map(
          (state) =>
            `<figure><figcaption>${state}</figcaption>${[360, 1280]
              .map(
                (w) =>
                  `<img src="${section}-${state}-${w}.png" class="w${w}" alt="(sem esta seção)">`,
              )
              .join("")}</figure>`,
        )
        .join("")}</div>`,
  )
  .join("");
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Estados das variantes</title><style>body{font:14px system-ui;margin:16px;background:#eee}.row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;background:#fff;padding:8px;border-radius:8px}img{display:block;width:100%;margin-top:6px;border:1px solid #ddd}img.w360{width:40%}</style>${rows}`,
);
const overflows = pictures.filter((p) => p.overflow > 0);
console.log(
  `Wrote ${pictures.length} pictures to ${out}${overflows.length ? `; sideways scroll in ${overflows.map((p) => `${p.state}@${p.width}`).join(", ")}` : ""}`,
);
