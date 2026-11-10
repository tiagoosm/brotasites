import { normalizeHost } from "@/lib/domains/routing";

// The click sparks (E31, click-sparks.tsx): a few short strokes that burst from where a
// pointer presses, on the platform's pages only. Pure, for the tests: where they show, and
// where each stroke is at a given moment.

/** The most strokes alive at once, whatever the clicking. */
export const MAX_SPARKS = 40;

/** Never in the team's area: its path on the platform, and the whole admin host. */
export function sparksAllowed(path: string, host: string, adminHost: string | null): boolean {
  if (path === "/admin" || path.startsWith("/admin/")) return false;
  if (adminHost && normalizeHost(host) === normalizeHost(adminHost)) return false;
  return true;
}

/** Inputs that are pressed rather than typed into keep their sparks. */
const PRESSED_INPUTS = new Set(["button", "submit", "reset", "checkbox", "radio", "image"]);

/** A field people type in (text, password, email...): pressing it gives no sparks. */
export function isTypingField(tag: string, type: string | null, editable: boolean): boolean {
  const name = tag.toLowerCase();
  if (editable || name === "textarea" || name === "select") return true;
  if (name !== "input") return false;
  return !PRESSED_INPUTS.has((type ?? "text").toLowerCase());
}

export interface Burst {
  /** Strokes in the burst. */
  count: number;
  /** Stroke length at the start, px. */
  length: [number, number];
  /** How far the strokes travel, px. */
  travel: [number, number];
  /** How long they live, ms. */
  duration: [number, number];
}

/** With a mouse: 7 strokes; on touch fewer and shorter, so a finger is never followed by fuss. */
export const BURSTS: Record<"mouse" | "touch", Burst> = {
  mouse: { count: 7, length: [8, 14], travel: [18, 28], duration: [450, 600] },
  touch: { count: 5, length: [6, 10], travel: [12, 18], duration: [360, 450] },
};

/** Strong ease-out: quick to leave the point, slow to settle. */
export const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/**
 * One stroke at progress t (0 to 1): its inner and outer distance from the point, its width
 * and its opacity. It flies out, shortens, thins and fades.
 */
export function strokeAt(t: number, length: number, travel: number, width = 2) {
  const e = easeOut(t);
  const inner = 3 + travel * e;
  return {
    inner,
    outer: inner + length * (1 - e),
    width: width * (1 - 0.75 * e),
    alpha: 1 - e,
  };
}
