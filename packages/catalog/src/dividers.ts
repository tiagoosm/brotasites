// Section dividers drawn as inline SVG. The sites' CSP (img-src 'self') blocks data: URIs, and
// an inline <svg> costs no request, so templates print the path directly in the markup.
// Every path paints the upper section's color hanging down into the next one: the SVG sits
// at the top of the lower section, filled with the upper section's background.

export interface Divider {
  id: string;
  /** Height in viewBox units (the width is always 1440); 0 means no SVG. */
  height: number;
  path: string;
}

const WIDTH = 1440;

function zigzag(tooth: number, depth: number): string {
  let path = `M0 0H${WIDTH}`;
  for (let x = WIDTH, down = true; x > 0; x -= tooth / 2, down = !down) {
    path += `L${x - tooth / 2} ${down ? depth : 0}`;
  }
  return `${path}Z`;
}

function scallop(radius: number): string {
  let path = `M0 0H${WIDTH}`;
  for (let x = WIDTH; x > 0; x -= radius * 2) {
    path += `A${radius} ${radius} 0 0 1 ${x - radius * 2} 0`;
  }
  return `${path}Z`;
}

// [left x, width, depth] of each drip, laid out by hand so they look poured, not repeated.
const drips: readonly [number, number, number][] = [
  [40, 70, 34],
  [190, 46, 52],
  [330, 90, 24],
  [520, 54, 44],
  [700, 76, 30],
  [880, 40, 56],
  [1010, 96, 26],
  [1200, 58, 46],
  [1340, 64, 28],
];

function drip(band: number): string {
  let path = `M0 0H${WIDTH}V${band}`;
  for (const [x, width, depth] of [...drips].reverse()) {
    const bottom = band + depth * 1.3;
    path += `L${x + width} ${band}C${x + width} ${bottom} ${x} ${bottom} ${x} ${band}`;
  }
  return `${path}L0 ${band}Z`;
}

export const dividers: readonly Divider[] = [
  { id: "straight", height: 0, path: "" },
  { id: "wave-soft", height: 64, path: `M0 0H${WIDTH}V26C1080 64 360 0 0 38Z` },
  { id: "wave-bold", height: 90, path: `M0 0H${WIDTH}V40C1200 90 960 90 720 45S240 0 0 50Z` },
  { id: "zigzag", height: 24, path: zigzag(48, 24) },
  { id: "scallop", height: 24, path: scallop(24) },
  { id: "drip", height: 86, path: drip(12) },
  { id: "arch", height: 90, path: `M0 0H${WIDTH}V8Q720 172 0 8Z` },
  { id: "slant", height: 60, path: `M0 0H${WIDTH}L0 60Z` },
];

/** Inline SVG markup for a divider, painted with `currentColor`. Empty for "straight". */
export function dividerSvg(divider: Divider): string {
  if (divider.height === 0) return "";
  return `<svg class="divider divider-${divider.id}" viewBox="0 0 ${WIDTH} ${divider.height}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path fill="currentColor" d="${divider.path}"/></svg>`;
}
