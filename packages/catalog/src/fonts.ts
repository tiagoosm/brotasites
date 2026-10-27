import { fileURLToPath } from "node:url";
import type { Personality } from "./personality.js";

// Fonts of client sites: open-license (SIL OFL 1.1) families hosted with the site as woff2,
// Latin subset only (it covers every Portuguese accent). Each folder in `fonts/` holds the
// files and the font's license; licenses are recorded in THIRD_PARTY_LICENSES.md.
// Files come from the Fontsource npm packages (5.3.0), which repackage the Google Fonts
// binaries; the source of each family is its `repository`. Fonts with a Reserved Font Name on
// their own name (Playfair Display) are left out: the OFL treats a subset as a modified version,
// which may not keep a reserved name.

export type FontCategory = "serif" | "sans" | "rounded" | "handwritten";

export interface FontFile {
  file: string;
  style: "normal" | "italic";
  /** A single weight ("400") or a variable range ("200 800"). */
  weight: string;
}

export interface Font {
  id: string;
  name: string;
  category: FontCategory;
  /** CSS fallback stack after the font itself. */
  fallback: string;
  files: readonly FontFile[];
  repository: string;
}

const serif = "Georgia, 'Times New Roman', serif";
const sans = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const hand = "'Comic Sans MS', cursive";

function variable(id: string, range: string, italic = false): FontFile[] {
  const files: FontFile[] = [
    { file: `${id}-latin-wght-normal.woff2`, style: "normal", weight: range },
  ];
  if (italic) files.push({ file: `${id}-latin-wght-italic.woff2`, style: "italic", weight: range });
  return files;
}

function single(id: string, italic = false): FontFile[] {
  const files: FontFile[] = [
    { file: `${id}-latin-400-normal.woff2`, style: "normal", weight: "400" },
  ];
  if (italic) files.push({ file: `${id}-latin-400-italic.woff2`, style: "italic", weight: "400" });
  return files;
}

export const fonts: readonly Font[] = [
  {
    id: "fraunces",
    name: "Fraunces",
    category: "serif",
    fallback: serif,
    files: variable("fraunces", "100 900", true),
    repository: "https://github.com/undercasetype/Fraunces",
  },
  {
    id: "instrument-serif",
    name: "Instrument Serif",
    category: "serif",
    fallback: serif,
    files: single("instrument-serif", true),
    repository: "https://github.com/Instrument/instrument-serif",
  },
  {
    id: "dm-serif-display",
    name: "DM Serif Display",
    category: "serif",
    fallback: serif,
    files: single("dm-serif-display", true),
    repository: "https://github.com/googlefonts/dm-fonts",
  },
  {
    id: "cormorant-garamond",
    name: "Cormorant Garamond",
    category: "serif",
    fallback: serif,
    files: variable("cormorant-garamond", "300 700", true),
    repository: "https://github.com/CatharsisFonts/Cormorant",
  },
  {
    id: "young-serif",
    name: "Young Serif",
    category: "serif",
    fallback: serif,
    files: single("young-serif"),
    repository: "https://github.com/noirblancrouge/YoungSerif",
  },
  {
    id: "bricolage-grotesque",
    name: "Bricolage Grotesque",
    category: "sans",
    fallback: sans,
    files: variable("bricolage-grotesque", "200 800"),
    repository: "https://github.com/ateliertriay/bricolage",
  },
  {
    id: "space-grotesk",
    name: "Space Grotesk",
    category: "sans",
    fallback: sans,
    files: variable("space-grotesk", "300 700"),
    repository: "https://github.com/floriankarsten/space-grotesk",
  },
  {
    id: "manrope",
    name: "Manrope",
    category: "sans",
    fallback: sans,
    files: variable("manrope", "200 800"),
    repository: "https://github.com/googlefonts/manrope",
  },
  {
    id: "dm-sans",
    name: "DM Sans",
    category: "sans",
    fallback: sans,
    files: variable("dm-sans", "100 1000", true),
    repository: "https://github.com/googlefonts/dm-fonts",
  },
  {
    id: "fredoka",
    name: "Fredoka",
    category: "rounded",
    fallback: sans,
    files: variable("fredoka", "300 700"),
    repository: "https://github.com/hafontia-zz/Fredoka-One",
  },
  {
    id: "baloo-2",
    name: "Baloo 2",
    category: "rounded",
    fallback: sans,
    files: variable("baloo-2", "400 800"),
    repository: "https://github.com/yanone/Baloo2-Variable",
  },
  {
    id: "caveat",
    name: "Caveat",
    category: "handwritten",
    fallback: hand,
    files: variable("caveat", "400 700"),
    repository: "https://github.com/googlefonts/caveat",
  },
  {
    id: "kalam",
    name: "Kalam",
    category: "handwritten",
    fallback: hand,
    files: single("kalam"),
    repository: "https://github.com/itfoundry/kalam",
  },
];

export interface FontPair {
  id: string;
  heading: string;
  body: string;
  /** Handwritten font for the small label above titles. */
  label: string;
  /** Heading weight used by the type scale. */
  headingWeight: number;
  personalities: readonly Personality[];
}

export const fontPairs: readonly FontPair[] = [
  {
    id: "fraunces-manrope",
    heading: "fraunces",
    body: "manrope",
    label: "caveat",
    headingWeight: 600,
    personalities: ["acolhedor", "elegante"],
  },
  {
    id: "young-serif-dm-sans",
    heading: "young-serif",
    body: "dm-sans",
    label: "caveat",
    headingWeight: 400,
    personalities: ["acolhedor", "robusto"],
  },
  {
    id: "cormorant-manrope",
    heading: "cormorant-garamond",
    body: "manrope",
    label: "kalam",
    headingWeight: 500,
    personalities: ["elegante"],
  },
  {
    id: "instrument-serif-dm-sans",
    heading: "instrument-serif",
    body: "dm-sans",
    label: "kalam",
    headingWeight: 400,
    personalities: ["elegante", "moderno"],
  },
  {
    id: "dm-serif-display-manrope",
    heading: "dm-serif-display",
    body: "manrope",
    label: "kalam",
    headingWeight: 400,
    personalities: ["robusto", "elegante"],
  },
  {
    id: "bricolage-dm-sans",
    heading: "bricolage-grotesque",
    body: "dm-sans",
    label: "caveat",
    headingWeight: 800,
    personalities: ["moderno", "ousado"],
  },
  {
    id: "space-grotesk-manrope",
    heading: "space-grotesk",
    body: "manrope",
    label: "kalam",
    headingWeight: 700,
    personalities: ["moderno", "robusto"],
  },
  {
    id: "fredoka-dm-sans",
    heading: "fredoka",
    body: "dm-sans",
    label: "caveat",
    headingWeight: 600,
    personalities: ["ousado", "acolhedor"],
  },
  {
    id: "baloo-manrope",
    heading: "baloo-2",
    body: "manrope",
    label: "caveat",
    headingWeight: 800,
    personalities: ["ousado"],
  },
];

const fontById = new Map(fonts.map((font) => [font.id, font]));

export function fontOf(id: string): Font {
  const font = fontById.get(id);
  if (!font) throw new Error(`Unknown font: ${id}`);
  return font;
}

export function fontPairOf(id: string): FontPair | undefined {
  return fontPairs.find((pair) => pair.id === id);
}

/** Pairs a client may switch to after approval: those that suit the identity's personality. */
export function compatibleFontPairs(personality: Personality): FontPair[] {
  return fontPairs.filter((pair) => pair.personalities.includes(personality));
}

/** Folder with one subfolder per font id (works from src and from dist). */
export const fontsDir = fileURLToPath(new URL("../fonts/", import.meta.url));

/** Latin subset: Basic Latin and Latin-1 (every Portuguese accent) plus common punctuation. */
export const LATIN_UNICODE_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

/** The files a pair needs, as paths relative to `fontsDir` ("fraunces/fraunces-...woff2"). */
export function fontPairFiles(pair: FontPair): string[] {
  return [pair.heading, pair.body, pair.label].flatMap((id) =>
    fontOf(id).files.map((file) => `${id}/${file.file}`),
  );
}

/** @font-face rules for a pair; `baseUrl` is where the site serves the font files. */
export function fontFaceCss(pair: FontPair, baseUrl = "/fonts/"): string {
  const ids = [...new Set([pair.heading, pair.body, pair.label])];
  return ids
    .flatMap((id) =>
      fontOf(id).files.map(
        (file) =>
          `@font-face{font-family:"${fontOf(id).name}";src:url("${baseUrl}${id}/${file.file}") format("woff2");font-style:${file.style};font-weight:${file.weight};font-display:swap;unicode-range:${LATIN_UNICODE_RANGE}}`,
      ),
    )
    .join("\n");
}

/**
 * Ways a title may highlight one word. Italics only when the heading font ships a real italic:
 * browsers fake a slanted one otherwise, which looks broken.
 */
export function headingHighlights(pair: FontPair): ("italic" | "color" | "underline")[] {
  const italic = fontOf(pair.heading).files.some((file) => file.style === "italic");
  return italic ? ["italic", "color", "underline"] : ["color", "underline"];
}

/** CSS font-family value for a font id. */
export function fontStack(id: string): string {
  const font = fontOf(id);
  return `"${font.name}", ${font.fallback}`;
}
