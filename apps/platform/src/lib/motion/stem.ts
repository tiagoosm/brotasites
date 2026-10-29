// The geometry of the home page stem (E18): one curved stroke that passes through the leaf of
// every question and bends gently (a light S) between them, tapering from the base (where the
// ink starts, at the top) to the young tip (at the last question). Pure, for the tests and for
// the server's first drawing; stem-geometry.tsx measures the real positions in the browser.

export interface Point {
  x: number;
  y: number;
}

/** A cubic Bézier segment. */
export interface Cubic {
  from: Point;
  c1: Point;
  c2: Point;
  to: Point;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** A point of a cubic segment at t (0 to 1). */
export function cubicAt(segment: Cubic, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * segment.from.x + b * segment.c1.x + c * segment.c2.x + d * segment.to.x,
    y: a * segment.from.y + b * segment.c1.y + c * segment.c2.y + d * segment.to.y,
  };
}

/**
 * The stem's centre line: from `top` down through each anchor (the y of every question's
 * leaf), always at `x` on an anchor, bending `bend` to one side and then the other between
 * them, so the line snakes down the column.
 */
export function stemSegments(anchors: number[], x: number, top: number, bend: number): Cubic[] {
  const segments: Cubic[] = [];
  let from: Point = { x, y: top };
  anchors.forEach((y, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const height = y - from.y;
    if (height <= 0) return;
    const to = { x, y };
    segments.push({
      from,
      c1: { x: x + side * bend, y: from.y + height / 3 },
      c2: { x: x + side * bend, y: from.y + (2 * height) / 3 },
      to,
    });
    from = to;
  });
  return segments;
}

/** The centre line as SVG path data (for the ink's mask and the pencil guide). */
export function centerlinePath(segments: Cubic[]): string {
  const first = segments[0];
  if (!first) return "";
  const parts = [`M${round(first.from.x)} ${round(first.from.y)}`];
  for (const s of segments) {
    parts.push(
      `C${round(s.c1.x)} ${round(s.c1.y)} ${round(s.c2.x)} ${round(s.c2.y)} ${round(s.to.x)} ${round(s.to.y)}`,
    );
  }
  return parts.join("");
}

/**
 * The stem's body: the centre line widened to `base` at the top and narrowed to `tip` at the
 * end, as one closed shape (a stroke cannot change width along its length).
 */
export function outlinePath(segments: Cubic[], base: number, tip: number, samples = 16): string {
  const points: Point[] = [];
  for (const [i, segment] of segments.entries()) {
    for (let k = i === 0 ? 0 : 1; k <= samples; k++) points.push(cubicAt(segment, k / samples));
  }
  if (points.length < 2) return "";
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    lengths.push((lengths[i - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = lengths.at(-1) || 1;
  const left: Point[] = [];
  const right: Point[] = [];
  points.forEach((p, i) => {
    const prev = points[Math.max(0, i - 1)] as Point;
    const next = points[Math.min(points.length - 1, i + 1)] as Point;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const length = Math.hypot(dx, dy) || 1;
    const u = (lengths[i] as number) / total;
    const half = (base + (tip - base) * u) / 2;
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    left.push({ x: p.x + nx, y: p.y + ny });
    right.push({ x: p.x - nx, y: p.y - ny });
  });
  const ring = [...left, ...right.reverse()];
  return `M${ring.map((p) => `${round(p.x)} ${round(p.y)}`).join("L")}Z`;
}

/**
 * Where the small leaflets between two questions sit: the middle of each segment, relative to
 * the anchor it ends on (dx sideways from the stem, dy above the anchor, both in px).
 */
export function midpoints(segments: Cubic[]): { dx: number; dy: number }[] {
  return segments.map((segment) => {
    const mid = cubicAt(segment, 0.5);
    return { dx: round(mid.x - segment.to.x), dy: round(segment.to.y - mid.y) };
  });
}

/** The stem as drawn on the server, before the browser measures: evenly spaced questions. */
export function defaultStem(count: number, width: number, height: number, x: number, bend: number) {
  const top = 8;
  const anchors = Array.from(
    { length: count },
    (_, i) => top + ((height - top - 24) * (i + 1)) / count,
  );
  const segments = stemSegments(anchors, x, top, bend);
  return {
    width,
    height,
    centerline: centerlinePath(segments),
    outline: outlinePath(segments, STEM_BASE, STEM_TIP),
    midpoints: midpoints(segments),
  };
}

/** The stem's width at the base and at the tip, in px. */
export const STEM_BASE = 4.2;
export const STEM_TIP = 1.4;

/**
 * A leaf's path mirrored left to right inside its `width`-wide box (for leaves on the left of
 * the stem), so no SVG transform is needed and CSS can animate the leaf freely. Only absolute
 * commands with x, y pairs (M, L, C, Q, Z), as the leaves are drawn.
 */
export function mirrorPath(d: string, width: number): string {
  let index = 0;
  return d
    .replace(/-?\d*\.?\d+/g, (number) => {
      const value = Number(number);
      const flipped = index % 2 === 0 ? round(width - value) : value;
      index += 1;
      return ` ${flipped}`;
    })
    .replace(/\s+/g, " ")
    .replace(/([MLCQZ]) /g, "$1")
    .trim();
}
