// The restricted dialect of section variants (docs/catalog-promotion.md): HTML and CSS only,
// motion only through data-anim attributes. Our own variants are checked against it in CI,
// and the future restricted code layer (AI_CODE_VARIANTS, off) will have to pass it too.
// It is a validator, not a sanitizer: anything outside the dialect is refused, never repaired.

export interface DialectIssue {
  rule: string;
  /** pt-BR, for the admin. */
  message: string;
  excerpt: string;
}

interface Rule {
  id: string;
  pattern: RegExp;
  message: string;
}

const markupRules: Rule[] = [
  { id: "script", pattern: /<script\b/i, message: "Variantes não podem ter JavaScript." },
  {
    id: "event-handler",
    pattern: /<[a-z][^>]*\son[a-z]+\s*=/i,
    message: "Atributos on* (eventos) não são permitidos.",
  },
  {
    id: "inline-style",
    pattern: /<[a-z][^>]*\sstyle\s*=/i,
    message: "Estilo inline não é permitido (CSP).",
  },
  {
    id: "style-tag-in-markup",
    pattern: /<style\b/i,
    message: "CSS só no bloco de estilo da variante.",
  },
  {
    id: "javascript-url",
    pattern: /(?:java|vb)script\s*:/i,
    message: "Links javascript: não são permitidos.",
  },
  {
    id: "data-url",
    pattern: /\b(?:src|href|srcset|poster)\s*=\s*["']?\s*data:/i,
    message: "URLs data: não são permitidas.",
  },
  {
    id: "external-resource",
    pattern: /\b(?:src|srcset|poster|action|formaction)\s*=\s*["']?\s*(?:https?:)?\/\//i,
    message: "Nenhum recurso externo: tudo vem do próprio site.",
  },
  {
    id: "forbidden-element",
    pattern:
      /<(?:iframe|object|embed|form|input|textarea|select|button\b[^>]*type=["']?submit|link|meta|base|frame|frameset|applet|video|audio|canvas)\b/i,
    message: "Elemento não permitido em variantes.",
  },
  {
    id: "client-directive",
    pattern: /\bclient:(?:load|idle|visible|media|only)\b/,
    message: "Componentes com JavaScript no cliente não são permitidos.",
  },
  {
    id: "set-html",
    pattern: /\bset:html\s*=/,
    message: "HTML cru (set:html) só nos componentes compartilhados.",
  },
];

const cssRules: Rule[] = [
  { id: "import", pattern: /@import\b/i, message: "@import não é permitido." },
  {
    id: "keyframes",
    pattern: /@keyframes\b/i,
    message: "Variantes não declaram @keyframes: o movimento vem de data-anim.",
  },
  {
    id: "transition",
    pattern: /(?:^|[;{\s])transition(?:-[a-z-]+)?\s*:/i,
    message: "Variantes não declaram transition.",
  },
  {
    id: "animation",
    pattern: /(?:^|[;{\s])animation(?:-[a-z-]+)?\s*:/i,
    message: "Variantes não declaram animation.",
  },
  {
    id: "url",
    pattern: /url\s*\(/i,
    message: "Nenhum url() em variantes: imagens e fontes vêm dos tokens.",
  },
  {
    id: "expression",
    pattern: /expression\s*\(|behavior\s*:|-moz-binding/i,
    message: "Recurso de CSS perigoso.",
  },
  { id: "font-face", pattern: /@font-face\b/i, message: "Fontes vêm só do catálogo." },
];

function find(rules: Rule[], text: string): DialectIssue[] {
  const issues: DialectIssue[] = [];
  for (const rule of rules) {
    const match = rule.pattern.exec(text);
    if (match) {
      const start = Math.max(0, match.index - 20);
      issues.push({
        rule: rule.id,
        message: rule.message,
        excerpt: text.slice(start, match.index + 60).trim(),
      });
    }
  }
  return issues;
}

/** Splits an Astro variant into its markup and its CSS; the frontmatter is left out. */
export function splitAstro(source: string): { markup: string; css: string } {
  const withoutFrontmatter = source.replace(/^---\n[\s\S]*?\n---\n/, "");
  const css = [...withoutFrontmatter.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1] ?? "")
    .join("\n");
  const markup = withoutFrontmatter.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  return { markup, css };
}

/** Issues of a variant written as markup and CSS (an empty list means it is in the dialect). */
export function checkVariant(parts: { markup: string; css: string }): DialectIssue[] {
  // CSS comments are not code, but they must not hide anything either: strip them first.
  const css = parts.css.replace(/\/\*[\s\S]*?\*\//g, "");
  const markup = parts.markup.replace(/<!--[\s\S]*?-->/g, "");
  return [...find(markupRules, markup), ...find(cssRules, css)];
}

/** Issues of an Astro variant file. */
export function checkAstroVariant(source: string): DialectIssue[] {
  return checkVariant(splitAstro(source));
}
