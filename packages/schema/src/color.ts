// WCAG 2 contrast helpers, used to keep client-chosen colors readable.

const WHITE = "#FFFFFF";
const BLACK = "#000000";

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Picks the candidate with the highest contrast against the background. */
export function mostReadable(background: string, candidates: string[]): string {
  return [...candidates, WHITE, BLACK].reduce((best, color) =>
    contrastRatio(background, color) > contrastRatio(background, best) ? color : best,
  );
}

/** Returns the first candidate that reaches the minimum ratio, or the most readable one. */
export function firstReadable(background: string, candidates: string[], minRatio = 4.5): string {
  return (
    candidates.find((color) => contrastRatio(background, color) >= minRatio) ??
    mostReadable(background, candidates)
  );
}
