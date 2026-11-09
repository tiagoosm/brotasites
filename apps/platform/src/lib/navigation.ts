// Navigations the code starts itself (router.push, router.replace) announce themselves, so the
// top progress bar (components/site/navigation-progress.tsx) answers at once, as it does for a
// clicked link (E26).

export const NAVIGATION_EVENT = "brotasites:navigate";

/** Shows the progress bar for a navigation started from code. */
export function announceNavigation(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NAVIGATION_EVENT));
}
