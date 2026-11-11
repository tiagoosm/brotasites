"use client";

import { useEffect } from "react";

// The hero title's letters lift toward the mouse (E31, owner's request): the letters nearest
// the cursor rise a little, the ones around them less, and they settle back when it leaves.
// Each letter is an inline span (split-words.tsx, `letters`), moved with `top` on a relative
// position: inline, so the title keeps its kerning, and an offset that never moves the words
// around it. The letters' places are read when the mouse comes in (and again after a scroll
// or a resize), never on a move; one frame loop runs only while letters are moving. Mouse
// only; nothing on touch screens, with reduced motion or without JavaScript.

/** The highest lift, and how far around the cursor it reaches, as fractions of the font size. */
const LIFT_EM = 0.14;
const REACH_EM = 0.6;
const EASE = 0.2;

interface Letter {
  element: HTMLElement;
  x: number;
  y: number;
  lift: number;
}

export default function TitleLift({ target }: { target: string }) {
  useEffect(() => {
    const title = document.getElementById(target);
    if (!title) return;
    const mouse = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = [...title.querySelectorAll<HTMLElement>(".char")];
    if (elements.length === 0) return;
    let letters: Letter[] = [];
    let size = 16;
    let pointer = { x: 0, y: 0 };
    let inside = false;
    let frame = 0;

    const measure = () => {
      size = Number.parseFloat(getComputedStyle(title).fontSize) || 16;
      letters = elements.map((element, i) => {
        const box = element.getBoundingClientRect();
        // The place without the current lift.
        const lift = letters[i]?.lift ?? 0;
        return {
          element,
          x: box.left + box.width / 2,
          y: box.top + box.height / 2 + lift,
          lift,
        };
      });
    };

    const step = () => {
      const reach = size * REACH_EM;
      const most = size * LIFT_EM;
      let moving = false;
      for (const letter of letters) {
        let goal = 0;
        if (inside) {
          const d = Math.hypot(pointer.x - letter.x, (pointer.y - letter.y) * 0.8);
          goal = most * Math.exp(-((d / reach) ** 2));
        }
        const next = letter.lift + (goal - letter.lift) * EASE;
        const settled = Math.abs(goal - next) < 0.05;
        letter.lift = settled ? goal : next;
        if (!settled) moving = true;
        letter.element.style.top = letter.lift > 0.05 ? `${-letter.lift.toFixed(2)}px` : "";
      }
      frame = moving ? requestAnimationFrame(step) : 0;
    };
    const run = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };

    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !mouse.matches || reduce.matches) return;
      measure();
      inside = true;
      title.setAttribute("data-lifting", "");
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !mouse.matches || reduce.matches) return;
      if (!inside) enter(event);
      pointer = { x: event.clientX, y: event.clientY };
      run();
    };
    const leave = () => {
      inside = false;
      run();
    };
    // The cached places move with the page.
    const stale = () => {
      if (inside) measure();
    };

    title.addEventListener("pointerenter", enter);
    title.addEventListener("pointermove", move, { passive: true });
    title.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", stale, { passive: true });
    window.addEventListener("resize", stale);
    return () => {
      cancelAnimationFrame(frame);
      title.removeEventListener("pointerenter", enter);
      title.removeEventListener("pointermove", move);
      title.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", stale);
      window.removeEventListener("resize", stale);
      for (const element of elements) element.style.top = "";
    };
  }, [target]);

  return null;
}
