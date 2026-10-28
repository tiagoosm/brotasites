import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { isSafeHref } from "@brotasites/schema/v1.2";
import type { Finding } from "./findings.js";

// Checks on the built files, without a browser: every resource is local, there is no script
// but JSON-LD, no event handler, no inline style (the strict CSP would block it), every link
// is an allowed one, every anchor has its target, every image has alt text and exists, and the
// page stays within its weight budget (docs/security.md, docs/default-motion.md).

export const WEIGHT_BUDGET = {
  /** Everything the page loads: HTML, CSS, JS, fonts, images. */
  totalBytes: 1_500_000,
  /** The motion script, gzipped (docs/default-motion.md). */
  scriptGzipBytes: 8 * 1024,
  /** One image after the pipeline (2000 px WebP is far below this). */
  imageBytes: 600_000,
} as const;

interface Tag {
  name: string;
  attrs: Record<string, string>;
  /** Text up to the closing tag, for <script> and <style>. */
  body?: string;
}

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
};
const decode = (value: string) =>
  value.replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, name) => entities[name] ?? "");

export function parseTags(html: string): Tag[] {
  const tags: Tag[] = [];
  const tagPattern = /<([a-zA-Z][\w-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  for (const match of html.matchAll(tagPattern)) {
    const name = (match[1] as string).toLowerCase();
    const attrs: Record<string, string> = {};
    for (const attr of (match[2] ?? "").matchAll(
      /([^\s=/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g,
    )) {
      attrs[(attr[1] as string).toLowerCase()] = decode(attr[2] ?? attr[3] ?? attr[4] ?? "");
    }
    const tag: Tag = { name, attrs };
    if (name === "script" || name === "style") {
      const end = html.indexOf(`</${name}`, (match.index ?? 0) + match[0].length);
      tag.body = html.slice((match.index ?? 0) + match[0].length, end === -1 ? undefined : end);
    }
    tags.push(tag);
  }
  return tags;
}

const isExternal = (url: string) =>
  /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url) || /^(data|blob|javascript):/i.test(url);

function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

export interface StaticCheckOptions {
  /** The base path the site was built with ("/" or "/n/"). */
  base?: string;
}

export function checkBuild(distDir: string, options: StaticCheckOptions = {}): Finding[] {
  const root = resolve(distDir);
  const base = options.base ?? "/";
  const findings: Finding[] = [];
  const add = (finding: Omit<Finding, "where"> & { where?: Finding["where"] }) =>
    findings.push({ where: "page", ...finding });

  const htmlPath = join(root, "index.html");
  if (!existsSync(htmlPath)) {
    add({ check: "build", severity: "high", message: "O build não gerou o index.html." });
    return findings;
  }
  const html = readFileSync(htmlPath, "utf8");
  const tags = parseTags(html);
  const ids = new Set(tags.map((tag) => tag.attrs.id).filter(Boolean));
  const localFile = (url: string) => {
    const path = url.split(/[?#]/)[0] as string;
    const inside = path.startsWith(base) ? path.slice(base.length) : path.replace(/^\//, "");
    return join(root, decodeURIComponent(inside));
  };

  const resources: string[] = [];
  for (const tag of tags) {
    for (const [name, value] of Object.entries(tag.attrs)) {
      if (/^on[a-z]+$/.test(name)) {
        add({
          check: "event-handler",
          severity: "high",
          security: true,
          message: `Atributo ${name} em <${tag.name}>.`,
        });
      }
      if (name === "style") {
        add({
          check: "inline-style",
          severity: "medium",
          message: `Estilo inline em <${tag.name}>: a CSP do site bloqueia.`,
        });
      }
      if (/^\s*javascript:/i.test(value)) {
        add({
          check: "unsafe-link",
          severity: "high",
          security: true,
          message: `Endereço javascript: em <${tag.name}>.`,
        });
      }
    }
    if (["iframe", "object", "embed", "frame", "applet", "base", "form"].includes(tag.name)) {
      add({
        check: "forbidden-tag",
        severity: "high",
        security: true,
        message: `Elemento <${tag.name}> não é permitido.`,
      });
    }
    if (tag.name === "script") {
      if (tag.attrs.src) resources.push(tag.attrs.src);
      else if (tag.attrs.type !== "application/ld+json") {
        add({
          check: "inline-script",
          severity: "high",
          security: true,
          message: "Script inline na página.",
        });
      }
    }
    if (
      tag.name === "link" &&
      tag.attrs.href &&
      !/\b(canonical|alternate)\b/.test(tag.attrs.rel ?? "")
    ) {
      resources.push(tag.attrs.href);
    }
    if (["img", "source", "video", "audio", "track", "input"].includes(tag.name)) {
      if (tag.attrs.src) resources.push(tag.attrs.src);
      if (tag.attrs.poster) resources.push(tag.attrs.poster);
      for (const candidate of (tag.attrs.srcset ?? "").split(",")) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url) resources.push(url);
      }
    }
    if (tag.name === "img" && !("alt" in tag.attrs)) {
      add({
        check: "image-alt",
        severity: "medium",
        message: `Imagem sem texto alternativo: ${tag.attrs.src ?? ""}.`,
      });
    }
    if (tag.name === "a" && "href" in tag.attrs) {
      const href = tag.attrs.href as string;
      if (href.startsWith("#")) {
        if (href.length > 1 && !ids.has(href.slice(1))) {
          add({
            check: "broken-anchor",
            severity: "medium",
            message: `O link ${href} não leva a nenhuma seção.`,
          });
        }
      } else if (href.startsWith("/")) {
        if (!existsSync(localFile(href))) {
          add({
            check: "broken-link",
            severity: "medium",
            message: `O link ${href} não existe no site.`,
          });
        }
      } else if (!isSafeHref(href)) {
        add({
          check: "unsafe-link",
          severity: "high",
          security: true,
          message: `Link não permitido: ${href}.`,
        });
      }
    }
  }

  const cssFiles = filesIn(root).filter((file) => file.endsWith(".css"));
  for (const file of cssFiles) {
    const css = readFileSync(file, "utf8");
    for (const match of css.matchAll(
      /url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(?:url\()?\s*['"]?([^'");\s]+)/g,
    )) {
      const url = (match[2] ?? match[3]) as string;
      if (isExternal(url) && !url.startsWith("data:image/svg+xml")) {
        add({
          check: "external-request",
          severity: "high",
          security: true,
          message: `O CSS ${relative(root, file)} carrega ${url.slice(0, 80)}.`,
        });
      }
    }
  }

  let total = statSync(htmlPath).size;
  let scriptGzip = 0;
  for (const url of new Set(resources)) {
    if (isExternal(url)) {
      add({
        check: "external-request",
        severity: "high",
        security: true,
        message: `A página carrega ${url.slice(0, 80)} de fora.`,
      });
      continue;
    }
    const file = localFile(url);
    if (!file.startsWith(root + sep) || !existsSync(file)) {
      add({
        check: "broken-resource",
        severity: "high",
        message: `Arquivo não encontrado: ${url}.`,
      });
      continue;
    }
    const size = statSync(file).size;
    total += size;
    if (file.endsWith(".js")) scriptGzip += gzipSync(readFileSync(file)).length;
    if (/\.(webp|jpe?g|png|avif)$/i.test(file) && size > WEIGHT_BUDGET.imageBytes) {
      add({
        check: "heavy-image",
        severity: "low",
        message: `A imagem ${url} tem ${Math.round(size / 1000)} KB.`,
      });
    }
  }
  // Fonts and images the CSS loads count too.
  for (const file of cssFiles) {
    for (const match of readFileSync(file, "utf8").matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
      const url = match[2] as string;
      if (isExternal(url) || url.startsWith("data:")) continue;
      const target = url.startsWith("/") ? localFile(url) : resolve(file, "..", url);
      if (existsSync(target)) total += statSync(target).size;
    }
  }
  if (total > WEIGHT_BUDGET.totalBytes) {
    add({
      check: "page-weight",
      severity: "medium",
      message: `A página pesa ${Math.round(total / 1000)} KB (limite ${WEIGHT_BUDGET.totalBytes / 1000} KB).`,
    });
  }
  if (scriptGzip > WEIGHT_BUDGET.scriptGzipBytes) {
    add({
      check: "script-weight",
      severity: "medium",
      message: `O JavaScript tem ${(scriptGzip / 1024).toFixed(1)} KB comprimido (limite 8 KB).`,
    });
  }
  return findings;
}
