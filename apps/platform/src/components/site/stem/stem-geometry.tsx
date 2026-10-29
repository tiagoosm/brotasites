"use client";

import { useEffect } from "react";
import {
  centerlinePath,
  midpoints,
  outlinePath,
  STEM_BASE,
  STEM_TIP,
  stemSegments,
} from "@/lib/motion/stem";

// Redraws the home page stem (stem.tsx) through the real positions of the questions: on load,
// when the width, the fonts or the content change (ResizeObserver). One measuring pass, then
// one writing pass; nothing runs while scrolling.

/** How far below a question's top its leaf grows from (px). */
const ANCHOR_DY = 18;

export function StemGeometry() {
  useEffect(() => {
    const list = document.querySelector<HTMLOListElement>("ol.stem");
    const svg = list?.querySelector<SVGSVGElement>(".stem-svg");
    if (!list || !svg) return;
    const nodes = [...list.querySelectorAll<HTMLLIElement>(":scope > .stem-node")];
    const guide = svg.querySelector<SVGPathElement>(".stem-guide");
    const body = svg.querySelector<SVGPathElement>(".stem-body");
    const ink = svg.querySelector<SVGPathElement>(".stem-ink-line");
    let frame = 0;

    const draw = () => {
      frame = 0;
      // Measure.
      const style = getComputedStyle(list);
      const width = Number.parseFloat(style.paddingLeft) || 56;
      const x = Number.parseFloat(style.getPropertyValue("--stem-x")) || 22;
      const height = list.clientHeight;
      const anchors = nodes.map((node) => node.offsetTop + ANCHOR_DY);
      // Write.
      const segments = stemSegments(anchors, x, 8, width < 70 ? 11 : 16);
      const centerline = centerlinePath(segments);
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      guide?.setAttribute("d", centerline);
      ink?.setAttribute("d", centerline);
      body?.setAttribute("d", outlinePath(segments, STEM_BASE, STEM_TIP));
      midpoints(segments).forEach((mid, i) => {
        nodes[i]?.style.setProperty("--mid-dx", `${mid.dx}px`);
      });
      list.setAttribute("data-stem-measured", "");
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const sized = new ResizeObserver(schedule);
    sized.observe(list);
    for (const node of nodes) sized.observe(node);
    document.fonts?.ready.then(schedule).catch(() => {});
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      sized.disconnect();
    };
  }, []);

  return null;
}
