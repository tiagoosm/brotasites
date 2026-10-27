import { contrastRatio } from "@brotasites/schema";

// OKLCH <-> sRGB hex (Björn Ottosson's OKLab), with gamut mapping by reducing chroma, and a
// contrast fixer that moves lightness until a WCAG ratio is met.

export interface Oklch {
  /** Lightness, 0 to 1. */
  l: number;
  /** Chroma, 0 to about 0.37. */
  c: number;
  /** Hue in degrees, 0 to 360. */
  h: number;
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function linearRgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0001 && v <= 1.0001);

/** Hex of an OKLCH color; out-of-gamut colors keep lightness and hue and lose chroma. */
export function oklchToHex(color: Oklch): string {
  let { c } = color;
  let rgb = linearRgb({ ...color, c });
  for (let step = 0; step < 40 && !inGamut(rgb); step++) {
    c *= 0.9;
    rgb = linearRgb({ ...color, c });
  }
  return `#${rgb
    .map((v) =>
      Math.round(toGamma(Math.min(1, Math.max(0, v))) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
}

export function hexToOklch(hex: string): Oklch {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255)) as [
    number,
    number,
    number,
  ];
  const l = Math.cbrt(0.4122214708 * r + 0.5363329762 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  const h = c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/**
 * Moves the foreground's lightness away from the background until the ratio is met. Returns
 * the first passing color; falls back to black or white, which always reach 4.5 on one side.
 */
export function ensureContrast(foreground: string, background: string, min = 4.5): string {
  if (contrastRatio(foreground, background) >= min) return foreground;
  const fg = hexToOklch(foreground);
  const bgLight = hexToOklch(background).l;
  const towardsDark = bgLight > 0.6 || (bgLight > 0.45 && fg.l < bgLight);
  for (let step = 1; step <= 50; step++) {
    const l = towardsDark ? fg.l - step * 0.02 : fg.l + step * 0.02;
    if (l < 0 || l > 1) break;
    const candidate = oklchToHex({ ...fg, l });
    if (contrastRatio(candidate, background) >= min) return candidate;
  }
  const black = "#000000";
  const white = "#FFFFFF";
  return contrastRatio(black, background) >= contrastRatio(white, background) ? black : white;
}

/** Linear mix in OKLab of two hex colors; `amount` 0 gives `a`, 1 gives `b`. */
export function mix(a: string, b: string, amount: number): string {
  const x = hexToOklch(a);
  const y = hexToOklch(b);
  const ax = x.c * Math.cos((x.h * Math.PI) / 180);
  const bx = x.c * Math.sin((x.h * Math.PI) / 180);
  const ay = y.c * Math.cos((y.h * Math.PI) / 180);
  const by = y.c * Math.sin((y.h * Math.PI) / 180);
  const A = ax + (ay - ax) * amount;
  const B = bx + (by - bx) * amount;
  return oklchToHex({
    l: x.l + (y.l - x.l) * amount,
    c: Math.hypot(A, B),
    h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
  });
}
