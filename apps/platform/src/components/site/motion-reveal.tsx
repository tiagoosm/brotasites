"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { planEntrances, RESET_MARGIN, shouldReset } from "@/lib/motion/reveal";

// Section entrances (see "Section entrances" in globals.css). Elements opt in with
// data-reveal ("words" for a title revealed word by word, "stem" for a question on the home
// page stem). The server renders them in their final state; this holds back the ones off
// screen and lets each one in every time it arrives, scrolling down or up (E18). The rules
// live in lib/motion/reveal.ts: reset only when fully off screen by a margin, a few entrances
// at a time, everything shown at once during a jump to a section (html[data-jumping]).
//
// States: "waiting" (hidden, off screen), "done" (entering with its transition), "shown"
// (final state at once). A handful of observers are shared by every element; nothing reads
// the layout in a loop.

/** About the longest entrance (the stagger included), to count the ones still running. */
const ENTRANCE_MS = 900;

export function MotionReveal() {
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs again for each new page
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let running = 0;
    const timers = new Set<number>();
    const jumping = () => document.documentElement.hasAttribute("data-jumping");

    const enter = (entries: IntersectionObserverEntry[]) => {
      const arriving = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target as HTMLElement)
        .filter((element) => element.dataset.entry === "waiting");
      if (arriving.length === 0) return;
      // Read every box first, then write (no layout in between).
      const boxes = arriving.map((element) => element.getBoundingClientRect());
      const order = arriving
        .map((element, i) => ({ element, box: boxes[i] as DOMRect }))
        .sort((a, b) => a.box.top - b.box.top);
      const plan = planEntrances(
        order.map(({ box }) => box),
        { running, jumping: jumping() },
      );
      order.forEach(({ element }, i) => {
        const step = plan[i];
        if (!step || step.mode === "instant") {
          element.dataset.entry = "shown";
          return;
        }
        if (element.dataset.reveal === "") {
          element.style.setProperty("--entry-index", String(step.index));
        }
        element.dataset.entry = "done";
        running += 1;
        const timer = window.setTimeout(() => {
          running = Math.max(0, running - 1);
          timers.delete(timer);
        }, ENTRANCE_MS);
        timers.add(timer);
      });
    };

    // Fully off screen by the margin: ready to enter again. The observer's margin is the
    // same, and the box is checked again so nothing visible is ever hidden.
    const leave = (entries: IntersectionObserverEntry[]) => {
      const height = window.innerHeight;
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (entry.isIntersecting || element.dataset.entry === "waiting") continue;
        if (shouldReset(entry.boundingClientRect, height)) element.dataset.entry = "waiting";
      }
    };

    // Sections enter a little before they are fully on screen, or once they are fully on
    // screen (near the end of the page an element may never reach the line). A question
    // waits for the tip of the stem's ink, which follows a point two thirds down the screen.
    const sections = new IntersectionObserver(enter, { rootMargin: "0px 0px -8% 0px" });
    const questions = new IntersectionObserver(enter, { rootMargin: "0px 0px -35% 0px" });
    const inFull = new IntersectionObserver(enter, { threshold: 1 });
    const away = new IntersectionObserver(leave, {
      rootMargin: `${RESET_MARGIN}px 0px ${RESET_MARGIN}px 0px`,
    });
    const observers = [sections, questions, inFull, away];

    const prepare = () => {
      const elements = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
      const height = window.innerHeight;
      const tops = elements.map((element) => element.getBoundingClientRect());
      elements.forEach((element, i) => {
        const box = tops[i] as DOMRect;
        // On screen now (a reload halfway down, a link to a section): shown as it is.
        // Elsewhere it waits, and enters when it arrives.
        element.dataset.entry = shouldReset(box, height, 0) ? "waiting" : "shown";
        if (element.dataset.reveal === "stem") {
          questions.observe(element);
        } else {
          sections.observe(element);
          inFull.observe(element);
        }
        away.observe(element);
      });
    };

    // Once the page is idle, so it does not lengthen the first load. Only elements off the
    // screen ever wait, so starting a little later changes nothing the visitor can see.
    const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 200));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    const task = idle(prepare, { timeout: 1000 });

    return () => {
      cancelIdle(task);
      for (const timer of timers) window.clearTimeout(timer);
      for (const observer of observers) observer.disconnect();
    };
  }, [pathname]);

  return null;
}
