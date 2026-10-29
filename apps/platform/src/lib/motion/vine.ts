// Where the mouse vine may show (E18): anywhere on the public pages except over content (text,
// buttons, links, cards, fields, images, the questions' window, the header and the footer).
// The content's boxes are measured now and then (vine-avoid.ts) and kept in page coordinates;
// each frame only shifts them by the scroll. Pure, for the tests and the 2D leaves; the WebGL
// stems apply the same rule in their shader.

/** A box: left, top, right, bottom. */
export type Rect = [number, number, number, number];

/** The vine fades out over this many px as it nears content. */
export const FEATHER = 10;
/** The most boxes the shader takes at once (the ones on screen). */
export const MAX_RECTS = 64;

/** Signed distance from a point to a box: negative inside, 0 on the edge. */
export function rectDistance(x: number, y: number, [left, top, right, bottom]: Rect): number {
  const dx = Math.max(left - x, x - right);
  const dy = Math.max(top - y, y - bottom);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0);
}

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** How visible the vine is at a point: 0 over content, 1 away from it, soft in between. */
export function vineAlpha(x: number, y: number, rects: readonly Rect[], feather = FEATHER): number {
  let alpha = 1;
  for (const rect of rects) {
    alpha = Math.min(alpha, smoothstep(0, feather, rectDistance(x, y, rect)));
    if (alpha === 0) break;
  }
  return alpha;
}

/** Drops boxes that sit inside another one (a paragraph inside a card): fewer boxes, same area. */
export function outermost(rects: Rect[]): Rect[] {
  return rects.filter(
    (inner, i) =>
      !rects.some(
        (outer, j) =>
          j !== i &&
          outer[0] <= inner[0] &&
          outer[1] <= inner[1] &&
          outer[2] >= inner[2] &&
          outer[3] >= inner[3] &&
          // Of two equal boxes, keep the first.
          (outer[0] !== inner[0] ||
            outer[1] !== inner[1] ||
            outer[2] !== inner[2] ||
            outer[3] !== inner[3] ||
            j < i),
      ),
  );
}

/**
 * The page boxes on screen now, in screen coordinates (page boxes shifted by the scroll), plus
 * the boxes that stay put (the sticky header), at most MAX_RECTS.
 */
export function onScreen(
  page: readonly Rect[],
  fixed: readonly Rect[],
  scrollY: number,
  height: number,
  max = MAX_RECTS,
): Rect[] {
  const out: Rect[] = [...fixed];
  for (const [left, top, right, bottom] of page) {
    const y0 = top - scrollY;
    const y1 = bottom - scrollY;
    if (y1 < -FEATHER || y0 > height + FEATHER) continue;
    out.push([left, y0, right, y1]);
    if (out.length >= max) break;
  }
  return out;
}
