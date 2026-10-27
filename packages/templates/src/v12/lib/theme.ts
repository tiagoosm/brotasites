import {
  createRandom,
  dividers,
  fontPairOf,
  gradientBackground,
  headingHighlights,
  imageTreatments,
  motionPresets,
  type Personality,
  patterns,
  type Rhythm,
  rhythms,
  type SectionTone,
  sectionTones,
  shapes,
  tokensCss,
  treatmentCss,
  typeScales,
} from "@brotasites/catalog";
import type { Identity, Palette, SiteConfig } from "@brotasites/schema/v1.2";

// The approved identity of a 1.2 site, resolved into catalog tokens and the CSS the site ships.
// The CSS goes into a file (/assets/site.css), never inline: the sites' CSP allows styles from
// the site itself only.

export interface Theme {
  identity: Identity;
  personality: Personality;
  palette: Palette;
  rhythm: Rhythm;
  /** Ways a title may highlight a word. */
  highlights: ("italic" | "color" | "underline")[];
  css: string;
}

function find<T extends { id: string }>(list: readonly T[], id: string, what: string): T {
  const item = list.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown ${what} in the identity: ${id}`);
  return item;
}

const tones: Record<SectionTone, string> = {
  base: "--bg:var(--color-background);--fg:var(--color-text);--fg-muted:var(--color-text-muted);--ornament:var(--color-accent);--button-bg:var(--color-primary);--button-fg:var(--color-on-primary);--card:var(--color-surface)",
  surface:
    "--bg:var(--color-surface);--fg:var(--color-text);--fg-muted:var(--color-text-muted);--ornament:var(--color-accent);--button-bg:var(--color-primary);--button-fg:var(--color-on-primary);--card:var(--color-background)",
  // Inverse and brand tones only use pairs that are already AA (text/background, onPrimary/primary).
  inverse:
    "--bg:var(--color-text);--fg:var(--color-background);--fg-muted:var(--color-background);--ornament:var(--color-background);--button-bg:var(--color-background);--button-fg:var(--color-text);--card:var(--color-text)",
  brand:
    "--bg:var(--color-primary);--fg:var(--color-on-primary);--fg-muted:var(--color-on-primary);--ornament:var(--color-on-primary);--button-bg:var(--color-on-primary);--button-fg:var(--color-primary);--card:var(--color-primary)",
};

export function resolveTheme(config: SiteConfig): Theme {
  const { identity, overrides } = config.design;
  if (!identity) throw new Error("O site ainda não tem uma direção aprovada.");
  const palette: Palette = { ...identity.palette, ...overrides.colors };
  const fontPair = fontPairOf(overrides.fontPair ?? identity.fontPair);
  if (!fontPair) throw new Error(`Unknown font pair: ${overrides.fontPair ?? identity.fontPair}`);
  const rhythm = find(rhythms, identity.rhythm, "rhythm");
  const treatment = find(imageTreatments, identity.imageTreatment, "photo treatment");
  const pattern = find(patterns, identity.pattern, "pattern");
  const gradient = gradientBackground(createRandom(`${config.design.seed}|gradient`), palette);

  const css = [
    tokensCss(
      {
        palette,
        fontPair,
        scale: find(typeScales, identity.typeScale, "type scale"),
        shape: find(shapes, identity.shape, "shape"),
        motion: find(motionPresets, identity.motionPreset, "motion preset"),
      },
      // Relative to /assets/site.css, so a site served under a sub-path still finds its fonts.
      "../fonts/",
    ),
    ...Object.entries(tones).map(([tone, vars]) => `.tone-${tone}{${vars}}`),
    pattern.background === "none" ? "" : `.has-pattern{background:${pattern.background},var(--bg)}`,
    `.gradient-bg{background:${gradient.background}}.gradient-bg::after{${gradient.grain}}`,
    // Every treatment ships (about 2 KB): some variants frame their photos their own way.
    treatmentCss(treatment),
    ...imageTreatments.filter((item) => item.id !== treatment.id).map((item) => item.css),
  ].join("\n");

  return {
    identity,
    personality: identity.personality,
    palette,
    rhythm,
    highlights: headingHighlights(fontPair),
    css,
  };
}

/** Tone of each enabled section after the hero. */
export function tonesFor(theme: Theme, count: number): SectionTone[] {
  return sectionTones(theme.rhythm, count);
}

export function dividerFor(theme: Theme) {
  return find(dividers, theme.identity.dividerStyle, "divider");
}
