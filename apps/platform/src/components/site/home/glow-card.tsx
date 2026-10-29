"use client";

import { type ComponentProps, useEffect, useRef } from "react";
import { lerpAngle, normalize, pointerAngle, resumeDelay } from "@/lib/motion/angle";
import { cn } from "@/lib/utils";

// The price card's border glow (".glow-card" in globals.css): a ring of the brand greens with
// a short arc of amber. At rest the light travels slowly round the border by itself (one turn
// every 12 s, a CSS animation of `rotate` on its own layer, E18); with the mouse over the card
// it follows the cursor and grows stronger near the edge, as before. It eases from where it is
// to the cursor (the short way round) and, when the mouse leaves, goes on turning from where
// it stopped. Touch screens keep the slow turn; reduced motion and no JavaScript get a soft,
// still glow. Paused off screen and in a hidden tab. Only `rotate` and `opacity` change.

const PERIOD_MS = 12_000;
const EASE = 0.18;
const REST_STRENGTH = 0.5;

function currentAngle(spin: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(spin).rotate);
  return Number.isFinite(value) ? value : -45;
}

export function GlowCard({ className, children, ...props }: ComponentProps<"div">) {
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const spins = [...element.querySelectorAll<HTMLElement>("[data-glow-spin]")];
    const lights = [...element.querySelectorAll<HTMLElement>("[data-glow-light]")];
    const first = spins[0];
    if (!first) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let box = { x: 0, y: 0, w: 0, h: 0 };
    let angle = 0;
    let target = 0;
    let frame = 0;
    let following = false;

    const paused = { offscreen: false, hidden: document.hidden };
    const applyPause = () => {
      element.toggleAttribute("data-glow-paused", paused.offscreen || paused.hidden);
    };
    const seen = new IntersectionObserver(([entry]) => {
      paused.offscreen = !entry?.isIntersecting;
      applyPause();
    });
    seen.observe(element);
    const onVisibility = () => {
      paused.hidden = document.hidden;
      applyPause();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const strength = (value: number) => {
      for (const light of lights) light.style.setProperty("--glow-strength", String(value));
    };
    const step = () => {
      angle = lerpAngle(angle, target, EASE);
      for (const spin of spins) spin.style.rotate = `${angle}deg`;
      frame = following ? requestAnimationFrame(step) : 0;
    };

    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || reduce.matches) return;
      const rect = element.getBoundingClientRect();
      box = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        w: rect.width,
        h: rect.height,
      };
      // Take over from the spin exactly where it is.
      angle = currentAngle(first);
      target = angle;
      following = true;
      for (const spin of spins) spin.style.rotate = `${angle}deg`;
      element.setAttribute("data-glow-following", "");
      if (!frame) frame = requestAnimationFrame(step);
    };
    const move = (event: PointerEvent) => {
      if (!following) return;
      const dx = event.clientX - box.x;
      const dy = event.clientY - box.y;
      // Unwrapped next to the current angle, so the easing always turns the short way.
      target = angle + (((pointerAngle(dx, dy) - normalize(angle) + 540) % 360) - 180);
      // 0 at the centre, 1 on the edge.
      const edge = Math.min(1, Math.max(Math.abs(dx) / (box.w / 2), Math.abs(dy) / (box.h / 2)));
      strength(0.45 + 0.55 * edge ** 2);
    };
    const leave = () => {
      if (!following) return;
      following = false;
      cancelAnimationFrame(frame);
      frame = 0;
      // Go on turning from here: the spin starts at this angle.
      for (const spin of spins) {
        spin.style.animationDelay = `${resumeDelay(angle, PERIOD_MS)}ms`;
        spin.style.removeProperty("rotate");
      }
      element.removeAttribute("data-glow-following");
      strength(REST_STRENGTH);
    };
    // The cached box moves with the page.
    const stale = () => {
      if (!following) return;
      const rect = element.getBoundingClientRect();
      box = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        w: rect.width,
        h: rect.height,
      };
    };

    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", stale, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", stale);
    };
  }, []);

  return (
    <div {...props} ref={card} className={cn("glow-card", className)}>
      <span aria-hidden="true" data-glow-light="" className="glow-ring">
        <span data-glow-spin="" className="glow-spin" />
      </span>
      <span aria-hidden="true" data-glow-light="" className="glow-halo">
        <span className="glow-clip">
          <span data-glow-spin="" className="glow-spin" />
        </span>
      </span>
      {children}
    </div>
  );
}
