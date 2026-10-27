import { contrastRatio } from "@brotasites/schema";
import type { Palette } from "@brotasites/schema/v1.2";
import { mix } from "./oklch.js";
import type { Random } from "./random.js";
import { GRAIN_ASSET_PATH } from "./treatments.js";

// Seeded gradient backgrounds with grain, for typographic heroes and bands. Blurred color
// spots sit at seeded positions; every color they reach is checked against the text color, so
// text over the gradient keeps 4.5:1 anywhere.

export interface GradientBackground {
  /** CSS `background` value. */
  background: string;
  /** CSS for a ::after layer with the grain. */
  grain: string;
  /** Colors the gradient reaches, for contrast checks. */
  stops: string[];
}

/** Strongest mix of `to` into `background` that keeps `text` readable on it. */
function readableMix(background: string, to: string, text: string, wanted: number): string {
  for (let amount = wanted; amount > 0; amount -= 0.05) {
    const color = mix(background, to, amount);
    if (contrastRatio(text, color) >= 4.5) return color;
  }
  return background;
}

export function gradientBackground(
  random: Random,
  palette: Palette,
  on: "background" | "surface" = "background",
): GradientBackground {
  const ground = palette[on];
  const sources = [palette.primary, palette.accent, palette.surface];
  const spots = Array.from({ length: 3 }, (_, index) => {
    const color = readableMix(
      ground,
      sources[index] as string,
      palette.text,
      random.range(0.25, 0.55),
    );
    const x = Math.round(random.range(0, 100));
    const y = Math.round(random.range(0, 100));
    const size = Math.round(random.range(45, 75));
    return {
      color,
      css: `radial-gradient(circle at ${x}% ${y}%, ${color} 0, transparent ${size}%)`,
    };
  });
  return {
    background: `${spots.map((spot) => spot.css).join(", ")}, ${ground}`,
    grain: `content:"";position:absolute;inset:0;background:url("${GRAIN_ASSET_PATH}");opacity:.3;mix-blend-mode:overlay;pointer-events:none`,
    stops: [ground, ...spots.map((spot) => spot.color)],
  };
}
