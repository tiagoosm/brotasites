import { contrastRatio } from "@brotasites/schema";
import type { Palette } from "@brotasites/schema/v1.2";
import { ensureContrast, hexToOklch, type Oklch, oklchToHex } from "./oklch.js";
import type { Personality } from "./personality.js";
import type { Random } from "./random.js";

// Palette generation in OKLCH: a recipe per personality sets the lightness and chroma of each
// role; the hue comes from the client's brand color or from the seed. Contrast is then
// enforced, so every palette that leaves this module passes WCAG AA:
// - text on background and on surface: 7:1 when reachable, never under 4.5:1;
// - muted text on background and surface, and onPrimary on primary: 4.5:1;
// - primary and accent against the background: 3:1 (buttons and ornaments, WCAG 1.4.11).

export type PaletteMode = "light" | "dark";

type Tone = { l: number; c: number; hueShift?: number; fixedHue?: number };

export interface PaletteRecipe {
  background: Tone;
  surface: Tone;
  text: Tone;
  textMuted: Tone;
  primary: Tone;
  accent: Tone;
}

export interface PersonalityPalettes {
  modes: readonly PaletteMode[];
  /** Hue ranges (degrees) used when the client gave no brand color. */
  hues: readonly [number, number][];
  /** Hue of the neutrals (background, text) when they are not tinted by the brand. */
  neutralHue: number;
  light: PaletteRecipe;
  dark?: PaletteRecipe;
}

export const personalityPalettes: Record<Personality, PersonalityPalettes> = {
  acolhedor: {
    modes: ["light"],
    hues: [
      [20, 75],
      [120, 160],
    ],
    neutralHue: 80,
    light: {
      background: { l: 0.975, c: 0.025, fixedHue: 85 },
      surface: { l: 0.935, c: 0.04, fixedHue: 80 },
      text: { l: 0.26, c: 0.03 },
      textMuted: { l: 0.45, c: 0.03 },
      primary: { l: 0.52, c: 0.14 },
      accent: { l: 0.62, c: 0.12, hueShift: 35 },
    },
  },
  elegante: {
    modes: ["light", "dark"],
    hues: [
      [60, 95],
      [200, 280],
      [330, 360],
    ],
    neutralHue: 70,
    light: {
      background: { l: 0.965, c: 0.008, fixedHue: 70 },
      surface: { l: 0.925, c: 0.01, fixedHue: 70 },
      text: { l: 0.2, c: 0.01 },
      textMuted: { l: 0.44, c: 0.01 },
      primary: { l: 0.34, c: 0.06 },
      accent: { l: 0.66, c: 0.08, fixedHue: 80 },
    },
    dark: {
      background: { l: 0.17, c: 0.008 },
      surface: { l: 0.22, c: 0.01 },
      text: { l: 0.95, c: 0.01, fixedHue: 80 },
      textMuted: { l: 0.76, c: 0.01, fixedHue: 80 },
      primary: { l: 0.8, c: 0.08, fixedHue: 82 },
      accent: { l: 0.62, c: 0.07 },
    },
  },
  moderno: {
    modes: ["light", "dark"],
    hues: [
      [230, 300],
      [140, 180],
      [10, 40],
    ],
    neutralHue: 260,
    light: {
      background: { l: 0.985, c: 0.004, fixedHue: 260 },
      surface: { l: 0.95, c: 0.012 },
      text: { l: 0.18, c: 0.02 },
      textMuted: { l: 0.45, c: 0.02 },
      primary: { l: 0.55, c: 0.2 },
      accent: { l: 0.82, c: 0.15, hueShift: 150 },
    },
    dark: {
      background: { l: 0.16, c: 0.02 },
      surface: { l: 0.22, c: 0.03 },
      text: { l: 0.97, c: 0.005 },
      textMuted: { l: 0.76, c: 0.02 },
      primary: { l: 0.72, c: 0.17 },
      accent: { l: 0.86, c: 0.14, hueShift: 150 },
    },
  },
  robusto: {
    modes: ["dark", "light"],
    // Warm accents only (red-orange to amber): lower hues turn pink at this lightness.
    hues: [[28, 75]],
    neutralHue: 60,
    light: {
      background: { l: 0.96, c: 0.015, fixedHue: 75 },
      surface: { l: 0.91, c: 0.02, fixedHue: 70 },
      text: { l: 0.16, c: 0.01, fixedHue: 60 },
      textMuted: { l: 0.4, c: 0.015, fixedHue: 60 },
      primary: { l: 0.46, c: 0.15 },
      accent: { l: 0.28, c: 0.04, fixedHue: 60 },
    },
    dark: {
      background: { l: 0.16, c: 0.008, fixedHue: 60 },
      surface: { l: 0.21, c: 0.012, fixedHue: 60 },
      text: { l: 0.95, c: 0.012, fixedHue: 80 },
      textMuted: { l: 0.77, c: 0.015, fixedHue: 75 },
      primary: { l: 0.72, c: 0.16 },
      accent: { l: 0.86, c: 0.09, hueShift: 15 },
    },
  },
  ousado: {
    modes: ["light", "dark"],
    hues: [[0, 360]],
    neutralHue: 0,
    light: {
      background: { l: 0.92, c: 0.07, hueShift: 180 },
      surface: { l: 0.975, c: 0.03, hueShift: 180 },
      text: { l: 0.2, c: 0.05 },
      textMuted: { l: 0.38, c: 0.05 },
      primary: { l: 0.56, c: 0.22 },
      accent: { l: 0.8, c: 0.17, hueShift: 120 },
    },
    dark: {
      background: { l: 0.3, c: 0.12 },
      surface: { l: 0.36, c: 0.13 },
      text: { l: 0.98, c: 0.02 },
      textMuted: { l: 0.86, c: 0.04 },
      primary: { l: 0.86, c: 0.17, hueShift: 120 },
      accent: { l: 0.7, c: 0.2, hueShift: -60 },
    },
  },
};

export interface PaletteOptions {
  personality: Personality;
  random: Random;
  mode?: PaletteMode;
  /** The client's brand colors; the first one leads. */
  brandColors?: readonly string[];
  /** Rotate the brand hue by this many degrees ("Evolução" direction); 0 keeps it. */
  hueShift?: number;
  /** Keep the first brand color exactly as the primary ("Fiel à marca"). */
  keepBrandColor?: boolean;
}

const wrap = (hue: number) => ((hue % 360) + 360) % 360;

function tone(spec: Tone, hue: number): string {
  const color: Oklch = {
    l: spec.l,
    c: spec.c,
    h: wrap(spec.fixedHue ?? hue + (spec.hueShift ?? 0)),
  };
  return oklchToHex(color);
}

/** Applies the contrast floors to any palette (also used after client overrides). */
export function enforceContrast(palette: Palette): Palette {
  const { background, surface } = palette;
  let text = ensureContrast(palette.text, background, 7);
  if (contrastRatio(text, background) < 4.5) text = ensureContrast(text, background, 4.5);
  text = ensureContrast(text, surface, 4.5);
  let textMuted = ensureContrast(palette.textMuted, background, 4.5);
  textMuted = ensureContrast(textMuted, surface, 4.5);
  // Buttons: on a light page the button is dark with white text, on a dark page the reverse.
  // Both rules then push the primary the same way, so they can always be met together.
  const lightPage = contrastRatio("#111111", background) > contrastRatio("#FFFFFF", background);
  const onPrimary = lightPage ? "#FFFFFF" : "#111111";
  let primary = ensureContrast(palette.primary, background, 3);
  primary = ensureContrast(primary, onPrimary, 4.5);
  const accent = ensureContrast(palette.accent, background, 3);
  return { background, surface, text, textMuted, primary, onPrimary, accent };
}

/** A palette for a personality, from the brand color or the seed; always passes AA. */
export function generatePalette(options: PaletteOptions): Palette {
  const { personality, random } = options;
  const config = personalityPalettes[personality];
  const mode = options.mode && config.modes.includes(options.mode) ? options.mode : config.modes[0];
  const recipe = (mode === "dark" ? config.dark : config.light) ?? config.light;
  const brand = options.brandColors?.[0];

  let hue: number;
  if (brand) {
    const color = hexToOklch(brand);
    // A gray brand color has no hue worth following: use the personality's neutral hue.
    hue = color.c < 0.02 ? config.neutralHue : color.h;
  } else {
    const [from, to] = random.pick(config.hues);
    hue = random.range(from, to);
  }
  hue = wrap(hue + (options.hueShift ?? 0));

  const palette: Palette = {
    background: tone(recipe.background, hue),
    surface: tone(recipe.surface, hue),
    text: tone(recipe.text, hue),
    textMuted: tone(recipe.textMuted, hue),
    primary: tone(recipe.primary, hue),
    onPrimary: "#FFFFFF",
    accent: tone(recipe.accent, hue),
  };
  if (brand && options.keepBrandColor && !options.hueShift) {
    palette.primary = brand.toUpperCase();
    const second = options.brandColors?.[1];
    if (second) palette.accent = second.toUpperCase();
  }
  return enforceContrast(palette);
}
