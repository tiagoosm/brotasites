"use client";

// A short vine that follows the mouse (E18, quieter in E31): one thin stem, about 140 px of
// tail at most, with a fine tip at the cursor and a slight sway; it shrinks and is gone about
// 0.4 s after the mouse stops. No leaves. It grew from Ribbons by React Bits
// (https://reactbits.dev, MIT + Commons Clause, see THIRD_PARTY_LICENSES.md); since E31 it is a
// 2D canvas rewrite, measured lighter than the WebGL ribbons it replaced (see PLAN.md, E31).
//
// It only draws while the tail is visible, clears only the box it drew last, never reads the
// layout on a frame (the content's boxes come from vine-avoid.ts), and stops on its own.

import { useEffect, useRef } from "react";
import { onScreen, type Rect, vineAlpha } from "@/lib/motion/vine";
import { type Avoid, watchContent } from "./vine-avoid";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** The stem's width along the tail: a fine tip at the cursor, fuller, then thinning out. */
const profile = (u: number) => (0.35 + 0.65 * smoothstep(0, 0.2, u)) * (1 - 0.55 * u);

/** How long after the last move the tail starts to shrink, and when it is gone (seconds). */
const IDLE_START = 0.06;
const IDLE_GONE = 0.4;

export interface VineTrailProps {
  color?: string;
  /** Widest point of the stem, in px. */
  thickness?: number;
  /** The whole drawing's opacity. */
  opacity?: number;
  /** The longest tail, in px along the path. */
  length?: number;
  /** Points along the tail. */
  points?: number;
  /** Sway, 0 to 1. */
  wave?: number;
  className?: string;
}

export default function VineTrail({
  color = "#2F5D45",
  thickness = 2,
  opacity = 0.28,
  length = 140,
  points = 18,
  wave = 0.15,
  className = "",
}: VineTrailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = {
    color,
    thickness,
    length: clamp(length, 20, 240),
    count: clamp(Math.round(points), 4, 32),
    wave: clamp(wave, 0, 1),
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    // A trail only makes sense with a mouse, and never for people who asked for less motion.
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reduced) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }

    const count = settingsRef.current.count;
    const xs = new Float32Array(count);
    const ys = new Float32Array(count);
    const drawX = new Float32Array(count);
    const drawY = new Float32Array(count);

    const state = {
      alive: true,
      raf: 0,
      last: 0,
      time: 0,
      lastMove: 0,
      visible: true,
      width: 1,
      height: 1,
      ratio: 1,
      mouseX: 0,
      mouseY: 0,
      // No tail on screen: the next move starts the vine at the cursor.
      resting: true,
      // The box drawn last, in CSS px (left, top, right, bottom), cleared on the next frame.
      dirty: null as Rect | null,
    };

    const resize = () => {
      // The canvas covers the whole window: keep it light.
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const pixelWidth = Math.max(1, Math.round(width * ratio));
      const pixelHeight = Math.max(1, Math.round(height * ratio));
      state.width = width;
      state.height = height;
      state.ratio = ratio;
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        state.dirty = null;
      }
    };

    const place = (x: number, y: number) => {
      xs.fill(x);
      ys.fill(y);
    };

    const simulate = (dt: number) => {
      const s = settingsRef.current;
      // The tip eases to the cursor; each point follows the one before it.
      const lead = 1 - Math.exp(-dt * 38);
      const follow = 1 - Math.exp(-dt * 26);
      xs[0] = (xs[0] as number) + (state.mouseX - (xs[0] as number)) * lead;
      ys[0] = (ys[0] as number) + (state.mouseY - (ys[0] as number)) * lead;
      for (let j = 1; j < count; j++) {
        xs[j] = (xs[j] as number) + ((xs[j - 1] as number) - (xs[j] as number)) * follow;
        ys[j] = (ys[j] as number) + ((ys[j - 1] as number) - (ys[j] as number)) * follow;
      }
      // The tail never runs past its length, and shrinks to nothing once the mouse rests.
      const idle = state.time - state.lastMove;
      const allowed = s.length * (1 - smoothstep(IDLE_START, IDLE_GONE, idle));
      let total = 0;
      for (let j = 1; j < count; j++) {
        const dx = (xs[j] as number) - (xs[j - 1] as number);
        const dy = (ys[j] as number) - (ys[j - 1] as number);
        const segment = Math.hypot(dx, dy);
        if (total + segment > allowed) {
          const keep = segment > 0 ? Math.max(0, allowed - total) / segment : 0;
          const endX = (xs[j - 1] as number) + dx * keep;
          const endY = (ys[j - 1] as number) + dy * keep;
          for (let k = j; k < count; k++) {
            xs[k] = endX;
            ys[k] = endY;
          }
          return allowed;
        }
        total += segment;
      }
      return total;
    };

    let avoid: Avoid = { page: [], fixed: [] };
    const stopWatching = watchContent((next) => {
      avoid = next;
      wake();
    });

    const clear = () => {
      if (!state.dirty) return;
      const [left, top, right, bottom] = state.dirty;
      const r = state.ratio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(
        Math.floor(left * r),
        Math.floor(top * r),
        Math.ceil((right - left) * r) + 2,
        Math.ceil((bottom - top) * r) + 2,
      );
      state.dirty = null;
    };

    const draw = (total: number) => {
      const s = settingsRef.current;
      clear();
      if (total < 0.5) return;
      // A slight sway across the stem, strongest mid-tail, none at the tip.
      const amplitude = s.wave * Math.min(s.thickness * 2.5, total * 0.05);
      let nx = 0;
      let ny = 0;
      for (let j = 0; j < count; j++) {
        const prev = Math.max(j - 1, 0);
        const next = Math.min(j + 1, count - 1);
        const dx = (xs[next] as number) - (xs[prev] as number);
        const dy = (ys[next] as number) - (ys[prev] as number);
        const len = Math.hypot(dx, dy);
        if (len > 1e-3) {
          nx = -dy / len;
          ny = dx / len;
        }
        const u = j / (count - 1);
        const swing =
          Math.sin(u * Math.PI * 2 - state.time * 3) * Math.sin(Math.PI * u) * amplitude;
        drawX[j] = (xs[j] as number) + nx * swing;
        drawY[j] = (ys[j] as number) + ny * swing;
      }
      // The content on screen now: the page's boxes shifted by the scroll (no layout read).
      const rects = onScreen(avoid.page, avoid.fixed, window.scrollY, state.height);
      const half = (s.thickness * smoothstep(0, s.thickness * 3, total)) / 2;
      let left = Number.POSITIVE_INFINITY;
      let top = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;
      ctx.setTransform(state.ratio, 0, 0, state.ratio, 0, 0);
      ctx.strokeStyle = s.color;
      ctx.lineCap = "round";
      for (let j = 0; j < count - 1; j++) {
        const x0 = drawX[j] as number;
        const y0 = drawY[j] as number;
        const x1 = drawX[j + 1] as number;
        const y1 = drawY[j + 1] as number;
        if (Math.abs(x1 - x0) + Math.abs(y1 - y0) < 0.05) continue;
        const u = (j + 0.5) / (count - 1);
        const alpha = (1 - smoothstep(0.55, 1, u)) * vineAlpha((x0 + x1) / 2, (y0 + y1) / 2, rects);
        if (alpha <= 0.01) continue;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Math.max(0.4, half * 2 * profile(u));
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        left = Math.min(left, x0, x1);
        top = Math.min(top, y0, y1);
        right = Math.max(right, x0, x1);
        bottom = Math.max(bottom, y0, y1);
      }
      ctx.globalAlpha = 1;
      if (right >= left) {
        const pad = s.thickness + 2;
        state.dirty = [left - pad, top - pad, right + pad, bottom + pad];
      }
    };

    const frame = (now: number) => {
      state.raf = 0;
      if (!state.alive) return;
      const dt = state.last ? Math.min(0.05, (now - state.last) / 1000) : 1 / 60;
      state.last = now;
      state.time += dt;
      const total = simulate(dt);
      draw(total);
      const moving = state.time - state.lastMove < IDLE_GONE;
      if (state.visible && (moving || total >= 0.5)) state.raf = requestAnimationFrame(frame);
      else {
        // At rest: nothing left on the canvas, no frame scheduled.
        clear();
        state.last = 0;
        state.resting = true;
      }
    };

    const wake = () => {
      if (!state.raf && state.alive && state.visible && !document.hidden) {
        state.raf = requestAnimationFrame(frame);
      }
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      // The canvas covers the whole window (fixed, inset 0): no box to read on each move.
      const x = event.clientX;
      const y = event.clientY;
      if (x < 0 || y < 0 || x > state.width || y > state.height) return;
      // Start where the cursor is, not where it was before resting or leaving the window.
      if (state.resting) place(x, y);
      state.resting = false;
      state.mouseX = x;
      state.mouseY = y;
      state.lastMove = state.time;
      wake();
    };

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);

    const visibility = new IntersectionObserver((entries) => {
      state.visible = entries.some((entry) => entry.isIntersecting);
      if (state.visible) wake();
    });
    visibility.observe(container);

    // A hidden tab stops drawing.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(state.raf);
        state.raf = 0;
        state.last = 0;
      } else {
        wake();
      }
    };

    const onLost = () => {
      state.alive = false;
      cancelAnimationFrame(state.raf);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("contextlost", onLost);
    resize();

    return () => {
      state.alive = false;
      cancelAnimationFrame(state.raf);
      stopWatching();
      resizeObserver.disconnect();
      visibility.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("contextlost", onLost);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none relative h-full w-full ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        style={{ opacity }}
      />
    </div>
  );
}
