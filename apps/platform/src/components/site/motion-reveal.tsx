"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Section entrances (see "Section entrances" in globals.css). Elements opt in with
// data-reveal (or data-reveal="stem" for a question on the home page stem). The server
// renders them in their final state; this only holds back the ones still below the screen
// and lets each one in once, when it arrives. Elements arriving together enter one after
// the other.

const STAGGER_CAP = 6;

export function MotionReveal() {
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs again for each new page
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observers: IntersectionObserver[] = [];
    const enter = (entries: IntersectionObserverEntry[]) => {
      let index = 0;
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (!entry.isIntersecting || element.dataset.entry === "done") continue;
        for (const observer of observers) observer.unobserve(element);
        if (element.dataset.reveal === "") {
          element.style.setProperty("--entry-index", String(Math.min(index, STAGGER_CAP)));
          index += 1;
        }
        element.dataset.entry = "done";
      }
    };

    // Sections enter a little before they are fully on screen, or once they are fully on
    // screen (near the end of the page an element may never reach the line). A question
    // waits for the tip of the stem's ink, which follows a point two thirds down the screen.
    const sections = new IntersectionObserver(enter, { rootMargin: "0px 0px -8% 0px" });
    const questions = new IntersectionObserver(enter, { rootMargin: "0px 0px -35% 0px" });
    const inFull = new IntersectionObserver(enter, { threshold: 1 });
    observers.push(sections, questions, inFull);

    // Read every position first, then write: alternating the two would make the browser lay
    // out the whole page again for each element.
    const pending = [...document.querySelectorAll<HTMLElement>("[data-reveal]")]
      .filter((element) => !element.dataset.entry)
      .map((element) => ({ element, top: element.getBoundingClientRect().top }));
    for (const { element, top } of pending) {
      // Already on screen (a reload halfway down, a link to a section): shown as it is.
      if (top < window.innerHeight) {
        element.dataset.entry = "done";
        continue;
      }
      element.dataset.entry = "waiting";
      if (element.dataset.reveal === "stem") {
        questions.observe(element);
      } else {
        sections.observe(element);
        inFull.observe(element);
      }
    }

    return () => {
      for (const observer of observers) observer.disconnect();
    };
  }, [pathname]);

  return null;
}
