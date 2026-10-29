// The smooth scroll to a section of the home page (E18): a duration that grows with the
// distance, within bounds, and an ease-in-out curve. Pure, for the tests; the browser part is
// components/site/anchor-scroll.tsx.

/** The sections the header, the phone menu, the footer and the hero link to. */
export const SECTIONS = ["como-funciona", "preco", "duvidas"] as const;

export const MIN_MS = 600;
export const MAX_MS = 900;
/** From this distance on (in px), the scroll takes the longest time. */
const FAR = 2400;

export function scrollDuration(distance: number): number {
  const far = Math.min(1, Math.abs(distance) / FAR);
  return Math.round(MIN_MS + (MAX_MS - MIN_MS) * far);
}

/** Ease in and out (cubic): slow start, fast middle, slow arrival. */
export function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** The section a link points to, if it is one of the home page's ("/#preco", "#preco"). */
export function sectionOf(href: string | null): string | null {
  if (!href) return null;
  const match = /^(?:\/)?#([a-z-]+)$/.exec(href);
  const id = match?.[1];
  return id && (SECTIONS as readonly string[]).includes(id) ? id : null;
}

/** Where the window stops: the section's top, below the sticky header, within the page. */
export function scrollTarget(
  sectionTop: number,
  scrollY: number,
  offset: number,
  maxScroll: number,
): number {
  return Math.round(Math.min(maxScroll, Math.max(0, sectionTop + scrollY - offset)));
}
