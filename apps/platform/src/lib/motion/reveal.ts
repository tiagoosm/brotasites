// The rules of the section entrances (motion-reveal.tsx, E18), kept pure for the tests.
//
// An element enters each time it comes back on screen, scrolling down or up. It is reset to
// "waiting" only once it is fully off screen by a margin, so nothing ever blinks while still
// visible. When many elements arrive at once (a fast scroll, a jump to a section, a reload
// halfway down) only a few animate; the rest are shown in their final state at once.

/** At most this many entrances run at the same time; the others are shown as they are. */
export const MAX_RUNNING = 8;
/** Elements arriving together enter one after the other, up to this many steps apart. */
export const STAGGER_CAP = 6;
/** How far off screen (in px) an element must be before it may enter again. */
export const RESET_MARGIN = 160;

export interface Box {
  top: number;
  bottom: number;
}

/** Fully off screen, by the margin: safe to hide for its next entrance. */
export function shouldReset(box: Box, viewportHeight: number, margin = RESET_MARGIN): boolean {
  return box.bottom < -margin || box.top > viewportHeight + margin;
}

export type Entrance = { mode: "animate"; index: number } | { mode: "instant" };

/**
 * How each arriving element enters, in the order given (top to bottom): animated, one after
 * the other, while fewer than MAX_RUNNING run; shown at once beyond that, during a jump to a
 * section, or when the element is already above the screen (scrolled past before it entered).
 */
export function planEntrances(
  boxes: Box[],
  options: { running: number; jumping: boolean; max?: number; cap?: number },
): Entrance[] {
  const max = options.max ?? MAX_RUNNING;
  const cap = options.cap ?? STAGGER_CAP;
  let room = Math.max(0, max - options.running);
  let index = 0;
  return boxes.map((box) => {
    if (options.jumping || box.bottom <= 0 || room === 0) return { mode: "instant" };
    room -= 1;
    return { mode: "animate", index: Math.min(index++, cap) };
  });
}
