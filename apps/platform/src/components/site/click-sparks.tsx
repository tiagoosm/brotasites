"use client";

// Click sparks (E31): a few short, rounded strokes burst from wherever a pointer presses on the
// platform's pages, in the pollen yellow only, and fade within about half a second. Designed
// after Click Spark by React Bits (https://reactbits.dev, MIT + Commons Clause); our own code.
//
// Never in the team's area (/admin, the admin host), never on a field people type in, never
// with reduced motion. One fixed 2D canvas, made on the first press; the frame loop runs only
// while strokes are alive (at most 40). Nothing here stops the press (no preventDefault), and
// no frame reads the layout. Above the content, below the header, menus and dialogs.

import { useEffect } from "react";
import { hosts } from "@/lib/domains/hosts";
import { BURSTS, isTypingField, MAX_SPARKS, sparksAllowed, strokeAt } from "@/lib/motion/sparks";

interface Spark {
  x: number;
  y: number;
  angle: number;
  length: number;
  travel: number;
  duration: number;
  born: number;
  color: string;
}

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min);

export default function ClickSparks() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    // Yellow only (owner's request): the pollen token.
    let color = "#e2b23c";
    let ratio = 1;
    let raf = 0;
    let sparks: Spark[] = [];
    let dirty = false;

    const size = () => {
      if (!canvas) return;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
    };

    const create = () => {
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.dataset.testid = "click-sparks";
      canvas.className = "pointer-events-none fixed inset-0 z-[15] h-full w-full";
      ctx = canvas.getContext("2d");
      const tokens = getComputedStyle(document.documentElement);
      color = tokens.getPropertyValue("--pollen").trim() || color;
      size();
      document.body.append(canvas);
      window.addEventListener("resize", size);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!canvas || !ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (dirty) ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparks = sparks.filter((spark) => now - spark.born < spark.duration);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = "round";
      for (const spark of sparks) {
        const stroke = strokeAt((now - spark.born) / spark.duration, spark.length, spark.travel);
        const cos = Math.cos(spark.angle);
        const sin = Math.sin(spark.angle);
        ctx.globalAlpha = stroke.alpha;
        ctx.strokeStyle = spark.color;
        ctx.lineWidth = stroke.width;
        ctx.beginPath();
        ctx.moveTo(spark.x + cos * stroke.inner, spark.y + sin * stroke.inner);
        ctx.lineTo(spark.x + cos * stroke.outer, spark.y + sin * stroke.outer);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      dirty = sparks.length > 0;
      if (dirty) raf = requestAnimationFrame(frame);
      canvas.dataset.sparks = String(sparks.length);
    };

    const onPress = (event: PointerEvent) => {
      if (reduce.matches || !event.isPrimary || event.button > 0) return;
      if (!sparksAllowed(window.location.pathname, window.location.host, hosts.adminHost)) return;
      const target = event.target instanceof Element ? event.target : null;
      const field = target?.closest("input, textarea, select, [contenteditable]");
      if (
        field &&
        isTypingField(
          field.tagName,
          field.getAttribute("type"),
          field instanceof HTMLElement && field.isContentEditable,
        )
      ) {
        return;
      }
      if (!canvas) create();
      const burst =
        BURSTS[event.pointerType === "mouse" || event.pointerType === "pen" ? "mouse" : "touch"];
      const now = performance.now();
      const turn = Math.random() * Math.PI * 2;
      for (let i = 0; i < burst.count; i++) {
        sparks.push({
          x: event.clientX,
          y: event.clientY,
          angle: turn + (i / burst.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35,
          length: between(burst.length),
          travel: between(burst.travel),
          duration: between(burst.duration),
          born: now,
          color,
        });
      }
      // The oldest go first when presses come faster than they fade.
      if (sparks.length > MAX_SPARKS) sparks = sparks.slice(-MAX_SPARKS);
      if (canvas) canvas.dataset.sparks = String(sparks.length);
      if (!raf) raf = requestAnimationFrame(frame);
    };

    window.addEventListener("pointerdown", onPress, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onPress, { capture: true });
      window.removeEventListener("resize", size);
      canvas?.remove();
    };
  }, []);

  return null;
}
