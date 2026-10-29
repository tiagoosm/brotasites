// Angles for the price card's glow (glow-card.tsx, E18), in degrees.

/** Into [0, 360). */
export function normalize(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** The signed turn from one angle to another, the short way round: in (-180, 180]. */
export function shortestDelta(from: number, to: number): number {
  const delta = normalize(to - from);
  return delta > 180 ? delta - 360 : delta;
}

/** A step of `t` (0 to 1) from one angle toward another, the short way round. */
export function lerpAngle(from: number, to: number, t: number): number {
  return from + shortestDelta(from, to) * t;
}

/** The angle of a point around a centre, with 0deg pointing up (as a conic gradient). */
export function pointerAngle(dx: number, dy: number): number {
  return normalize((Math.atan2(dy, dx) * 180) / Math.PI + 90);
}

/** The negative delay that starts a spin of `period` ms at the given angle. */
export function resumeDelay(angle: number, period: number): number {
  return -(normalize(angle) / 360) * period;
}
