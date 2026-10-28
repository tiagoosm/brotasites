import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, sep } from "node:path";
import { createRandom } from "@brotasites/catalog";
import { KIT_BASE } from "./generate.js";

// Assembles what the participants see (docs/blind-test.md): every pair's two sites under
// neutral numbers (sites/01 to sites/20), A and B drawn at random in each pair, nothing in the
// pages or their code that tells who made them, a start page, one page per pair and a printable
// answer sheet. The answer key goes to a separate folder that is never shown to participants.

export type Origin = "brotasites" | "hand";

export interface KeyPair {
  pair: number;
  slug: string;
  name: string;
  a: { site: string; origin: Origin };
  b: { site: string; origin: Origin };
}

export interface AnswerKey {
  version: 1;
  seed: string;
  pairs: KeyPair[];
}

const textTypes = new Set([
  ".html",
  ".htm",
  ".css",
  ".js",
  ".mjs",
  ".svg",
  ".xml",
  ".txt",
  ".json",
  ".webmanifest",
]);

/** Folder names that give away the tool that made a site, and their neutral names. */
const renamedFolders: Record<string, string> = { _astro: "arquivos" };

/** A neutral file name: tool names in built file names (e.g. "Page.astro_astro_type_script"). */
export const neutralName = (name: string) => name.replace(/\.?astro_?/gi, "-").replace(/-+/g, "-");

/** Tool names inside the code, renamed the same way in HTML, CSS and JS so nothing breaks. */
export function neutralCode(text: string): string {
  return text.replace(/data-astro-/g, "data-s-");
}

/** Removes what tells who or what made a page: comments, generator tags, its own address. */
export function anonymizeHtml(html: string): string {
  let out = neutralCode(html)
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, "")
    .replace(/<meta\s+name=["']generator["'][^>]*>/gi, "")
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\s+property=["']og:url["'][^>]*>/gi, "")
    // The site's address in structured data (it names the hosting domain).
    .replace(/"url":"https?:\/\/[^"]*",?/g, "");
  if (!/<meta\s+name=["']robots["']/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, '<head$1><meta name="robots" content="noindex, nofollow">');
  }
  return out;
}

async function walk(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

/**
 * Copies a site into the kit, anonymized. A generated site's placeholder base becomes a path
 * relative to each file, so the kit works from any folder of any static host.
 */
export async function copySite(from: string, to: string, slug: string | null): Promise<string[]> {
  const warnings: string[] = [];
  const base = slug ? `/${KIT_BASE}/${slug}/` : null;
  const files = await walk(from);
  const renamedFiles = new Map<string, string>();
  for (const file of files) {
    const name = file.split(sep).at(-1) ?? "";
    if (neutralName(name) !== name) renamedFiles.set(name, neutralName(name));
  }
  for (const file of files) {
    const path = relative(from, file)
      .split(sep)
      .map((part) => renamedFolders[part] ?? renamedFiles.get(part) ?? part)
      .join("/");
    const target = join(to, ...path.split("/"));
    await mkdir(dirname(target), { recursive: true });
    const ext = extname(file).toLowerCase();
    if (!textTypes.has(ext)) {
      await writeFile(target, await readFile(file));
      continue;
    }
    let text = await readFile(file, "utf8");
    if (base) {
      const depth = path.split("/").length - 1;
      const up = depth === 0 ? "./" : "../".repeat(depth);
      text = text.replaceAll(base, up);
    }
    for (const [name, renamed] of Object.entries(renamedFolders)) {
      text = text.replaceAll(`/${name}/`, `/${renamed}/`).replaceAll(`"${name}/`, `"${renamed}/`);
    }
    for (const [name, renamed] of renamedFiles) text = text.replaceAll(name, renamed);
    text = neutralCode(text);
    if (path === "robots.txt") text = "User-agent: *\nDisallow: /\n";
    if (ext === ".html" || ext === ".htm") {
      text = anonymizeHtml(text);
      if (/\s(?:href|src)=["']\/(?!\/)/.test(text)) {
        warnings.push(`${path}: caminho começando com "/" (use caminhos relativos)`);
      }
    }
    if (/brota\s*sites|__kit__|astro|sites\.localhost/i.test(text)) {
      warnings.push(`${path}: ainda menciona a ferramenta ou a base provisória`);
    }
    await writeFile(target, text);
  }
  return warnings;
}

export interface AssembleOptions {
  /** The folder with generated/<slug>/ (from generateSites) and hand/<slug>/ (the designers'). */
  kitDir: string;
  /** Changes the draw of numbers and of A and B. */
  seed: string;
  /** The businesses' names by slug, for the key and the facilitator. */
  names: Record<string, string>;
}

export interface AssembleResult {
  key: AnswerKey;
  missing: string[];
  warnings: string[];
}

const two = (n: number) => String(n).padStart(2, "0");

export async function assembleKit(options: AssembleOptions): Promise<AssembleResult> {
  const { kitDir } = options;
  const random = createRandom(`blind-test|${options.seed}`);
  const shuffle = <T>(items: T[]) => {
    const list = [...items];
    for (let i = list.length - 1; i > 0; i--) {
      const j = random.int(0, i);
      [list[i], list[j]] = [list[j] as T, list[i] as T];
    }
    return list;
  };

  const slugs = Object.keys(options.names).sort();
  const missing: string[] = [];
  const ready = slugs.filter((slug) => {
    const generated = existsSync(join(kitDir, "generated", slug, "index.html"));
    const hand = existsSync(join(kitDir, "hand", slug, "index.html"));
    if (!generated) missing.push(`generated/${slug}/index.html`);
    if (!hand) missing.push(`hand/${slug}/index.html`);
    return generated && hand;
  });
  if (ready.length === 0) throw new Error("Nenhum par completo para montar o kit.");

  const participants = join(kitDir, "participantes");
  const keyDir = join(kitDir, "chave");
  await rm(participants, { recursive: true, force: true });
  await mkdir(join(participants, "sites"), { recursive: true });
  await mkdir(keyDir, { recursive: true });

  const numbers = shuffle(Array.from({ length: ready.length * 2 }, (_, i) => two(i + 1)));
  const pairs: KeyPair[] = [];
  const warnings: string[] = [];
  for (const [index, slug] of shuffle(ready).entries()) {
    const generatedFirst = random.next() < 0.5;
    const origins: [Origin, Origin] = generatedFirst
      ? ["brotasites", "hand"]
      : ["hand", "brotasites"];
    const sites = [numbers[index * 2] as string, numbers[index * 2 + 1] as string];
    for (const [side, origin] of origins.entries()) {
      const site = sites[side] as string;
      const from = join(kitDir, origin === "brotasites" ? "generated" : "hand", slug);
      const found = await copySite(
        from,
        join(participants, "sites", site),
        origin === "brotasites" ? slug : null,
      );
      warnings.push(...found.map((warning) => `sites/${site}/${warning}`));
    }
    pairs.push({
      pair: index + 1,
      slug,
      name: options.names[slug] ?? slug,
      a: { site: sites[0] as string, origin: origins[0] },
      b: { site: sites[1] as string, origin: origins[1] },
    });
  }

  const key: AnswerKey = { version: 1, seed: options.seed, pairs };
  await writeFile(join(keyDir, "chave.json"), `${JSON.stringify(key, null, 2)}\n`);
  await writeFile(join(keyDir, "respostas.csv"), "participante;perfil;par;ia;prefere\n");
  await writeFile(join(participants, "index.html"), startPage(pairs.length));
  for (const pair of pairs) {
    await writeFile(join(participants, `par-${two(pair.pair)}.html`), pairPage(pair, pairs.length));
  }
  await writeFile(join(participants, "ficha.html"), answerSheet(pairs.length));
  return { key, missing, warnings };
}

// The participants' pages (pt-BR). Neutral on purpose: no name of a tool or of a company.

const style = `
:root { color-scheme: light; --ink: #1c1917; --muted: #57534e; --line: #d6d3d1; --bg: #fafaf9; }
* { box-sizing: border-box; }
body { margin: 0; font: 17px/1.55 system-ui, sans-serif; color: var(--ink); background: var(--bg); }
main { max-width: 44rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
h1 { font-size: 1.6rem; line-height: 1.2; }
a { color: inherit; }
.pairs { list-style: none; padding: 0; display: grid; gap: .5rem; grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr)); }
.pairs a, .open { display: flex; align-items: center; justify-content: center; min-height: 3rem; padding: .75rem 1rem; border: 1px solid var(--line); border-radius: .5rem; background: #fff; text-decoration: none; font-weight: 600; }
.sites { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; margin: 1.5rem 0; }
.open { min-height: 6rem; font-size: 1.25rem; }
nav { display: flex; justify-content: space-between; gap: 1rem; margin-top: 2rem; }
nav a { display: inline-flex; align-items: center; min-height: 2.75rem; }
.muted { color: var(--muted); }
table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
th, td { border: 1px solid var(--line); padding: .5rem; text-align: left; }
.box { display: inline-block; width: 1rem; height: 1rem; border: 1.5px solid var(--ink); vertical-align: -.15rem; margin-right: .25rem; }
@media print { body { background: #fff; font-size: 13px; } main { padding: 0; } }
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>${style}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

function startPage(count: number): string {
  const links = Array.from(
    { length: count },
    (_, i) => `<li><a href="par-${two(i + 1)}.html">Par ${i + 1}</a></li>`,
  ).join("\n");
  return page(
    "Teste de sites",
    `<h1>Teste de sites de pequenos negócios</h1>
<p>Você vai ver ${count} pares de sites. Os dois sites de cada par são do mesmo negócio (os negócios são fictícios). Em cada par, um site foi feito por uma pessoa e o outro com ajuda de inteligência artificial.</p>
<p>Para cada par, abra o site A e o site B, olhe com calma (no celular ou no computador) e responda na ficha:</p>
<ol>
<li>Qual dos dois foi feito por inteligência artificial?</li>
<li>Qual você preferiria ter para o seu negócio?</li>
</ol>
<p class="muted">Não existe resposta certa para a segunda pergunta. Se não tiver certeza na primeira, marque o seu palpite.</p>
<p><a href="ficha.html">Ficha de respostas</a> (para imprimir ou copiar)</p>
<h2>Pares</h2>
<p class="muted">Comece pelo par que a pessoa que aplica o teste indicar e siga em ordem.</p>
<ul class="pairs">
${links}
</ul>`,
  );
}

function pairPage(pair: KeyPair, count: number): string {
  const previous = pair.pair > 1 ? pair.pair - 1 : count;
  const next = pair.pair < count ? pair.pair + 1 : 1;
  return page(
    `Par ${pair.pair}`,
    `<h1>Par ${pair.pair}</h1>
<p>Os dois sites são do mesmo negócio. Abra cada um, role até o fim e volte aqui.</p>
<div class="sites">
<a class="open" href="sites/${pair.a.site}/">Site A</a>
<a class="open" href="sites/${pair.b.site}/">Site B</a>
</div>
<p>Na ficha, no par ${pair.pair}: qual foi feito por inteligência artificial (A ou B)? Qual você preferiria ter (A ou B)?</p>
<nav><a href="par-${two(previous)}.html">← Par ${previous}</a><a href="index.html">Início</a><a href="par-${two(next)}.html">Par ${next} →</a></nav>`,
  );
}

function answerSheet(count: number): string {
  const rows = Array.from(
    { length: count },
    (_, i) =>
      `<tr><td>${i + 1}</td><td><span class="box"></span>A &nbsp; <span class="box"></span>B</td><td><span class="box"></span>A &nbsp; <span class="box"></span>B</td></tr>`,
  ).join("\n");
  return page(
    "Ficha de respostas",
    `<h1>Ficha de respostas</h1>
<p>Participante (nome ou código): ______________________</p>
<p>Você é: <span class="box"></span>dono(a) de negócio &nbsp; <span class="box"></span>designer &nbsp; <span class="box"></span>outro</p>
<table>
<thead><tr><th scope="col">Par</th><th scope="col">Qual foi feito por IA?</th><th scope="col">Qual você preferiria ter?</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<p><a href="index.html">Voltar ao início</a></p>`,
  );
}
